#!/usr/bin/env bash
set -Eeuo pipefail

readonly repo_root="${1:?repository mount path is required}"
# shellcheck source=/dev/null
source "$repo_root/deploy/service.conf"
candidate_digest="$(printf 'a%.0s' {1..64})"
readonly candidate_digest
readonly candidate_image="$EXPECTED_IMAGE_REPOSITORY@sha256:$candidate_digest"
pull_image="$EXPECTED_IMAGE_REPOSITORY:sha-$(printf 'b%.0s' {1..40})"
readonly pull_image
readonly local_image="$candidate_image"
readonly previous_image='registry.invalid/example@sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'

docker() {
  local format target
  case "${1:-} ${2:-}" in
    'info --format')
      if [[ "$*" == *Swarm.ControlAvailable* ]]; then printf '%s\n' true; else printf '%s\n' node-1; fi
      ;;
    'node inspect')
      if [[ "${!#}" == "$TARGET_NODE" ]]; then
        if [[ "${FAKE_TARGET_UNAVAILABLE:-false}" != true ]]; then printf '%s\n' worker-1; fi
      elif [[ "$*" == *Status.Addr* ]]; then printf '%s\n' 192.168.1.103
      elif [[ "$*" == *Spec.Role* ]]; then printf '%s\n' manager
      else printf '%s\n' true
      fi
      ;;
    'node ls') printf '%s\n' node-1 ;;
    'service inspect')
      target="${!#}"
      test "$target" = "$SERVICE_NAME"
      if [[ "$*" != *' --format '* ]]; then return 0; fi
      format="$4"
      if [[ "$format" == *Spec.TaskTemplate.ContainerSpec.Image* ]]; then cat "$FAKE_STATE/image"
      elif [[ "$format" == *Placement.Constraints* ]]; then cat "$FAKE_STATE/placement"
      elif [[ "$format" == *Spec.TaskTemplate* ]]; then cat "$FAKE_STATE/template"
      elif [[ "$format" == *UpdateStatus* ]]; then cat "$FAKE_STATE/update-state"
      elif [[ "$format" == *FailureAction* ]]; then printf '%s\n' rollback
      else echo "Unexpected service inspect format: $format" >&2; return 1
      fi
      ;;
    'service ls') printf '%s 1/1\n' "$SERVICE_NAME" ;;
    'service update')
      [[ " $* " == *" --with-registry-auth "* ]]
      [[ " $* " != *" --constraint-rm node.hostname==$TARGET_NODE "* ]]
      [[ " $* " == *" --constraint-add node.hostname==$TARGET_NODE "* ]] \
        || tr -d '[:blank:]' <"$FAKE_STATE/placement" | grep -Fxq "node.hostname==$TARGET_NODE"
      if [[ " $* " == *" --constraint-add node.hostname==$TARGET_NODE "* ]]; then
        printf '%s\n' "node.hostname==$TARGET_NODE" >"$FAKE_STATE/placement"
      fi
      printf '%s' worker-1 >"$FAKE_STATE/node"
      printf '%s' "$local_image" >"$FAKE_STATE/image"
      printf '%s' '{"candidate":true}' >"$FAKE_STATE/template"
      printf '%s' completed >"$FAKE_STATE/update-state"
      printf '%s' candidate-id >"$FAKE_STATE/container-image"
      if [[ "${FAKE_CANDIDATE_UNHEALTHY:-false}" == true ]]; then
        printf '%s' unhealthy >"$FAKE_STATE/health"
      else
        printf '%s' healthy >"$FAKE_STATE/health"
      fi
      printf '%s\n' update >>"$FAKE_STATE/events"
      ;;
    'service rollback')
      printf '%s' manager-1 >"$FAKE_STATE/node"
      printf '%s\n' 'node.role == manager' >"$FAKE_STATE/placement"
      printf '%s' "$previous_image" >"$FAKE_STATE/image"
      printf '%s' '{"candidate":false}' >"$FAKE_STATE/template"
      printf '%s' rollback_completed >"$FAKE_STATE/update-state"
      printf '%s' previous-id >"$FAKE_STATE/container-image"
      printf '%s' healthy >"$FAKE_STATE/health"
      printf '%s\n' rollback >>"$FAKE_STATE/events"
      ;;
    'service ps') printf '%s\n' task-1 ;;
    'ps --filter') echo 'Manager-local container lookup is forbidden' >&2; return 1 ;;
    'inspect --type')
      if [[ "$*" == *Status.State* ]]; then
        if [[ "$(cat "$FAKE_STATE/health")" == healthy ]]; then printf '%s\n' running; else printf '%s\n' starting; fi
      elif [[ "$*" == *NodeID* ]]; then cat "$FAKE_STATE/node"
      elif [[ "$*" == *Spec.ContainerSpec.Image* ]]; then cat "$FAKE_STATE/image"
      else return 1
      fi
      ;;
    'inspect --format')
      if [[ "$3" == *State.Health* ]]; then cat "$FAKE_STATE/health"
      elif [[ "$3" == *'.Image'* ]]; then cat "$FAKE_STATE/container-image"
      else echo "Unexpected container inspect format: $3" >&2; return 1
      fi
      ;;
    'pull '*) return 0 ;;
    'tag '*) return 0 ;;
    'image inspect')
      if [[ "$4" == *RepoDigests* ]]; then printf '%s\n' "$candidate_image"
      elif [[ "$4" == *'.Id'* ]]; then printf '%s\n' candidate-id
      else echo "Unexpected image inspect format: $4" >&2; return 1
      fi
      ;;
    *) echo "Unexpected docker call: $*" >&2; return 1 ;;
  esac
}

flock() { return 0; }
sleep() { SECONDS=$((SECONDS + 1000)); }
export -f docker flock sleep

reset_state() {
  rm -rf -- "$FAKE_STATE"
  mkdir -p "$FAKE_STATE"
  printf '%s' "$previous_image" >"$FAKE_STATE/image"
  printf '%s' '{"candidate":false}' >"$FAKE_STATE/template"
  printf '%s' completed >"$FAKE_STATE/update-state"
  printf '%s' previous-id >"$FAKE_STATE/container-image"
  printf '%s' healthy >"$FAKE_STATE/health"
  printf '%s' manager-1 >"$FAKE_STATE/node"
  printf '%s\n' 'node.role == manager' >"$FAKE_STATE/placement"
  : >"$FAKE_STATE/events"
}

run_deploy() {
  STARSNAP_DEPLOY_IMAGE="$candidate_image" \
  STARSNAP_PULL_IMAGE="$pull_image" \
  STARSNAP_DEPLOY_LOCK_PATH=/runner-state/test-deploy.lock \
    bash "$repo_root/deploy/deploy-production.sh"
}

FAKE_STATE="$(mktemp -d)"
export FAKE_STATE SERVICE_NAME TARGET_NODE candidate_image pull_image local_image previous_image
trap 'rm -rf -- "$FAKE_STATE"' EXIT

reset_state
success_output="$(run_deploy 2>&1)" || {
  printf '%s\n' "$success_output" >&2
  exit 1
}
grep -Fq 'Scoped deployment verified' <<<"$success_output"
test "$(grep -c '^update$' "$FAKE_STATE/events")" -eq 1

printf '%s' "$local_image" >"$FAKE_STATE/image"
printf '%s' '{"candidate":true}' >"$FAKE_STATE/template"
: >"$FAKE_STATE/events"
run_deploy | grep -Fq 'Deployment already current'
test ! -s "$FAKE_STATE/events"

reset_state
export FAKE_CANDIDATE_UNHEALTHY=true
if run_deploy >/dev/null 2>&1; then
  echo 'Expected unhealthy candidate deployment to fail.' >&2
  exit 1
fi
grep -Fxq rollback "$FAKE_STATE/events"
test "$(cat "$FAKE_STATE/image")" = "$previous_image"
test "$(cat "$FAKE_STATE/health")" = healthy

unset FAKE_CANDIDATE_UNHEALTHY
reset_state
export FAKE_TARGET_UNAVAILABLE=true
if run_deploy >/dev/null 2>&1; then
  echo 'Expected unavailable worker preflight to fail.' >&2
  exit 1
fi
test ! -s "$FAKE_STATE/events"
unset FAKE_TARGET_UNAVAILABLE

reset_state
printf '%s' worker-1 >"$FAKE_STATE/node"
printf '%s\n' "node.hostname==$TARGET_NODE" >"$FAKE_STATE/placement"
run_deploy | grep -Fq 'Scoped deployment verified'
grep -Fxq "node.hostname==$TARGET_NODE" "$FAKE_STATE/placement"

reset_state
printf '%s' worker-1 >"$FAKE_STATE/node"
printf '%s\n' "node.hostname == $TARGET_NODE" >"$FAKE_STATE/placement"
run_deploy | grep -Fq 'Scoped deployment verified'
grep -Fxq "node.hostname == $TARGET_NODE" "$FAKE_STATE/placement"

echo 'deploy-production tests passed'
