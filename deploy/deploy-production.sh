#!/usr/bin/env bash
set -Eeuo pipefail
set +x
umask 077

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
readonly script_dir
# shellcheck source=/dev/null
source "$script_dir/service.conf"
: "${SERVICE_NAME:?SERVICE_NAME is required in service.conf}"
: "${TARGET_NODE:?TARGET_NODE is required in service.conf}"
: "${EXPECTED_IMAGE_REPOSITORY:?EXPECTED_IMAGE_REPOSITORY is required in service.conf}"
: "${ROLLOUT_TIMEOUT_SECONDS:?ROLLOUT_TIMEOUT_SECONDS is required in service.conf}"

readonly manager_address='192.168.1.103'
readonly manager_label='starsnap.actions-runner'
readonly lock_path="${STARSNAP_DEPLOY_LOCK_PATH:-/runner-state/starsnap-production-deploy.lock}"
readonly candidate_image="${STARSNAP_DEPLOY_IMAGE:?STARSNAP_DEPLOY_IMAGE is required}"
readonly pull_image="${STARSNAP_PULL_IMAGE:?STARSNAP_PULL_IMAGE is required}"
readonly service_name="$SERVICE_NAME"
readonly expected_repository="$EXPECTED_IMAGE_REPOSITORY"
readonly rollout_timeout_seconds="$ROLLOUT_TIMEOUT_SECONDS"

previous_image=''
previous_task_hash=''
update_attempted=0

single_running_task() {
  local task_ids
  task_ids="$(docker service ps "$service_name" --filter desired-state=running --quiet)" || return 1
  test "$(awk 'NF {count++} END {print count + 0}' <<<"$task_ids")" -eq 1 || return 1
  awk 'NF {print; exit}' <<<"$task_ids"
}

service_is_on_target() {
  local task
  task="$(single_running_task)" || return 1
  test "$(docker inspect --type task --format '{{.NodeID}}' "$task")" = "$target_node_id" || return 1
  docker service inspect --format '{{range .Spec.TaskTemplate.Placement.Constraints}}{{println .}}{{end}}' "$service_name" \
    | tr -d '[:blank:]' | grep -Fxq "node.hostname==$TARGET_NODE"
}

task_template_hash() {
  docker service inspect --format '{{json .Spec.TaskTemplate}}' "$service_name" \
    | sha256sum | awk '{print $1}'
}

service_is_healthy() {
  local task replicas update_state
  replicas="$(docker service ls --filter "name=$service_name" \
    --format '{{.Name}} {{.Replicas}}' \
    | awk -v target="$service_name" '$1 == target {print $2}')" || return 1
  test "$replicas" = '1/1' || return 1
  update_state="$(docker service inspect \
    --format '{{if .UpdateStatus}}{{.UpdateStatus.State}}{{else}}completed{{end}}' \
    "$service_name" 2>/dev/null)" || return 1
  [[ "$update_state" =~ ^(completed|rollback_completed)$ ]] || return 1
  task="$(single_running_task)" || return 1
  # Swarm keeps healthchecked containers in Starting until their check passes.
  test "$(docker inspect --type task --format '{{.Status.State}}' "$task")" = running || return 1
  test "$(docker inspect --type task --format '{{.Spec.ContainerSpec.Image}}' "$task")" \
    = "$(docker service inspect --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' "$service_name")"

}

wait_for_candidate() {
  local deadline=$((SECONDS + rollout_timeout_seconds))
  local current_image update_state
  while (( SECONDS < deadline )); do
    current_image="$(docker service inspect \
      --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' \
      "$service_name" 2>/dev/null || true)"
    update_state="$(docker service inspect \
      --format '{{if .UpdateStatus}}{{.UpdateStatus.State}}{{else}}completed{{end}}' \
      "$service_name" 2>/dev/null || true)"
    case "$update_state" in
      paused|rollback_paused|rollback_started|rollback_completed)
        echo "$service_name entered failure state: $update_state" >&2
        return 1
        ;;
    esac
    if [[ "$current_image" == "$runtime_image" && "$update_state" == 'completed' ]] \
      && service_is_healthy && service_is_on_target; then
      return 0
    fi
    sleep 3
  done
  echo "Timed out waiting for $service_name to converge." >&2
  return 1
}

wait_for_previous() {
  local deadline=$((SECONDS + rollout_timeout_seconds))
  while (( SECONDS < deadline )); do
    if [[ "$(task_template_hash 2>/dev/null || true)" == "$previous_task_hash" ]] \
      && [[ "$(docker service inspect \
        --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' \
        "$service_name" 2>/dev/null || true)" == "$previous_image" ]] \
      && service_is_healthy; then
      return 0
    fi
    sleep 3
  done
  return 1
}

rollback_on_failure() {
  local status="${1:-1}"
  trap - ERR HUP INT TERM
  set +e
  if (( update_attempted == 1 )); then
    if [[ "$(task_template_hash 2>/dev/null || true)" != "$previous_task_hash" ]]; then
      echo "Rolling $service_name back to its previous task specification." >&2
      docker service rollback --detach=true "$service_name" >/dev/null 2>&1
    fi
    if wait_for_previous; then
      echo "Rollback verified for $service_name: $previous_image" >&2
    else
      echo "CRITICAL: rollback verification failed for $service_name." >&2
      docker service ps --no-trunc "$service_name" >&2 || true
    fi
  fi
  exit "$status"
}

trap 'rollback_on_failure $?' ERR
trap 'rollback_on_failure 129' HUP
trap 'rollback_on_failure 130' INT
trap 'rollback_on_failure 143' TERM

test "$(docker info --format '{{.Swarm.ControlAvailable}}')" = 'true'
test "$(docker node inspect self --format '{{.Status.Addr}}')" = "$manager_address"
node_id="$(docker info --format '{{.Swarm.NodeID}}')"
readonly node_id
test -n "$node_id"
test "$(docker node inspect --format '{{.Spec.Role}}' "$node_id")" = 'manager'
test "$(docker node inspect \
  --format "{{with index .Spec.Labels \"$manager_label\"}}{{.}}{{end}}" \
  "$node_id")" = 'true'
labeled_nodes="$(docker node ls \
  --filter "node.label=$manager_label=true" --format '{{.ID}}')"
readonly labeled_nodes
test "$(awk 'NF {count++} END {print count + 0}' <<<"$labeled_nodes")" -eq 1
test "$labeled_nodes" = "$node_id"

target_node_id="$(docker node inspect --format '{{if and (eq .Status.State "ready") (eq .Spec.Availability "active") (eq .Spec.Role "worker")}}{{.ID}}{{end}}' "$TARGET_NODE")"
readonly target_node_id
test -n "$target_node_id"

command -v flock >/dev/null
case "$lock_path" in
  /runner-state/*) ;;
  *) echo "Refusing unexpected deployment lock path: $lock_path" >&2; exit 1 ;;
esac
exec 9>"$lock_path"
flock --wait 900 9

docker service inspect "$service_name" >/dev/null
service_is_healthy
test "$(docker service inspect \
  --format '{{if .Spec.UpdateConfig}}{{.Spec.UpdateConfig.FailureAction}}{{else}}pause{{end}}' \
  "$service_name")" = 'rollback'

readonly digest_prefix="$expected_repository@sha256:"
test "${candidate_image#"$digest_prefix"}" != "$candidate_image"
readonly digest="${candidate_image#"$digest_prefix"}"
[[ "$digest" =~ ^[0-9a-f]{64}$ ]]
case "$pull_image" in
  "$expected_repository":sha-[0-9a-f]*) ;;
  *) echo "Unexpected pull image: $pull_image" >&2; exit 1 ;;
esac

docker pull "$pull_image" >/dev/null
repo_digests="$(docker image inspect \
  --format '{{range .RepoDigests}}{{println .}}{{end}}' "$pull_image")"
readonly repo_digests
test "$(grep -Fxc "$candidate_image" <<<"$repo_digests")" -eq 1
readonly runtime_image="$candidate_image"

previous_image="$(docker service inspect \
  --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' "$service_name")"
readonly previous_image
previous_task_hash="$(task_template_hash)"
readonly previous_task_hash
[[ "$previous_task_hash" =~ ^[0-9a-f]{64}$ ]]

if [[ "$previous_image" == "$runtime_image" ]] && service_is_healthy && service_is_on_target; then
  trap - ERR HUP INT TERM
  printf 'Deployment already current: service=%s image=%s\n' "$service_name" "$candidate_image"
  exit 0
fi

placement_args=()
has_target_constraint=false
while IFS= read -r constraint; do
  case "${constraint//[[:space:]]/}" in
    "node.hostname==$TARGET_NODE") has_target_constraint=true ;;
    node.id==*|node.hostname==*|node.role==*|node.labels.starsnap.actions-runner==*)
      placement_args+=(--constraint-rm "$constraint") ;;
  esac
done < <(docker service inspect --format '{{range .Spec.TaskTemplate.Placement.Constraints}}{{println .}}{{end}}' "$service_name")
if [[ "$has_target_constraint" != true ]]; then
  placement_args+=(--constraint-add "node.hostname==$TARGET_NODE")
fi

update_attempted=1
docker service update --detach=true --no-resolve-image --with-registry-auth \
  "${placement_args[@]}" \
  --image "$runtime_image" "$service_name" >/dev/null
wait_for_candidate
service_is_on_target

trap - ERR HUP INT TERM
printf 'Scoped deployment verified: service=%s image=%s\n' \
  "$service_name" "$candidate_image"
