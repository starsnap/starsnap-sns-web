import React, { useCallback, useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import ProfileHeader from '../../components/ui/ProfileHeader'
import Tabs from '../../components/ui/Tabs'
import MasonryGrid from '../../components/ui/MasonryGrid'
import { getPhotoAspectRatio, type Snap } from '../../constant/mock/snaps'
import {
    disconnectFan,
    fromStarRouteKey,
    getFanState,
    getSnaps,
    joinFan,
    searchStarGroups,
    searchStars,
    type SnapFeedItem,
    type SnapSliceResponse,
    type StarGroupSearchItem,
    type StarSearchItem,
} from '../../services/snapService'
import { queryKeys } from '../../services/queryKeys'

const tabs = ['스냅', '정보']

const StarProfileHeaderSkeleton: React.FC = () => (
    <div
        className="rounded-2xl border border-line bg-panel p-4 sm:p-6"
        role="status"
        aria-busy="true"
        aria-label="스타 프로필 불러오는 중"
    >
        <div className="flex animate-pulse flex-col gap-4 sm:flex-row sm:items-start sm:gap-6" aria-hidden="true">
            <span className="h-20 w-20 shrink-0 rounded-full bg-placeholder sm:h-24 sm:w-24 lg:h-28 lg:w-28" />
            <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
                    <div className="space-y-2">
                        <span className="block h-7 w-40 rounded bg-placeholder" />
                        <span className="block h-4 w-32 rounded bg-placeholder" />
                        <span className="block h-4 w-24 rounded bg-placeholder" />
                    </div>
                    <div className="grid grid-cols-3 gap-3 pt-1 sm:gap-5 lg:gap-8">
                        {Array.from({ length: 3 }, (_, index) => (
                            <div key={index} className="space-y-1.5 text-center">
                                <span className="mx-auto block h-5 w-8 rounded bg-placeholder" />
                                <span className="mx-auto block h-3 w-10 rounded bg-placeholder" />
                            </div>
                        ))}
                    </div>
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <span className="h-11 w-full rounded-xl bg-placeholder sm:w-24" />
                    <span className="h-11 w-full rounded-xl bg-placeholder sm:w-20" />
                </div>
            </div>
        </div>
    </div>
)

const toSnapCard = (item: SnapFeedItem, index: number): Snap => ({
    id: item.snapData.snapId,
    author: item.createdUser.username,
    authorImageKey: item.createdUser.imageKey ?? null,
    aspectRatio: getPhotoAspectRatio(item.snapData.photos?.[0], index),
    photoKey: item.snapData.photos?.[0]?.fileKey,
    liked: !!item.snapData.likeState,
})

const parseCount = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : 0
    }
    return 0
}

const getLikeCount = (item: SnapFeedItem): number => {
    const root = item as unknown as Record<string, unknown>
    const snapData = (item.snapData ?? {}) as Record<string, unknown>

    // Backend schema may vary by endpoint/version, so we support common keys.
    return Math.max(
        parseCount(snapData.likeCount),
        parseCount(snapData.likes),
        parseCount(snapData.likeCnt),
        parseCount(root.likeCount),
        parseCount(root.likes),
        parseCount(root.likeCnt),
    )
}

const StarSnapPage: React.FC = () => {
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const { starId } = useParams<{ starId: string }>()
    const location = useLocation()
    const [tab, setTab] = useState(tabs[0])
    const [fanLoading, setFanLoading] = useState(false)
    const stateStar = (location.state as { star?: StarSearchItem } | null)?.star ?? null
    const { name, nickname } = useMemo(() => {
        if (!starId) {
            return { name: '', nickname: undefined }
        }

        return fromStarRouteKey(starId)
    }, [starId])
    const starSearchQuery = useQuery({
        queryKey: queryKeys.stars(name, 0, 50),
        queryFn: () => searchStars(name, 0, 50),
        enabled: !stateStar && !!name,
    })

    const star = useMemo(() => {
        if (stateStar) return stateStar
        const items = starSearchQuery.data ?? []
        const exact = items.find((item) => item.name === name && (nickname ? item.nickname === nickname : true))
        return exact ?? items[0] ?? null
    }, [stateStar, starSearchQuery.data, name, nickname])

    const starGroupsQuery = useQuery({
        queryKey: queryKeys.starGroups('', 0, 500),
        queryFn: () => searchStarGroups('', 0, 500),
        enabled: !!star?.starGroup?.name,
    })

    const loading = !stateStar && !!name && starSearchQuery.isLoading

    const snapsQuery = useQuery({
        queryKey: queryKeys.starSnaps(star?.id ?? '', 0, 0),
        queryFn: async () => {
            if (!star?.id) return []

            const all: SnapSliceResponse['content'] = []
            let page = 0

            while (true) {
                const response = await getSnaps({
                    size: 100,
                    page,
                    tag: [],
                    title: '',
                    user: null,
                    starId: [star.id],
                    starGroupId: [],
                })
                all.push(...response.content)

                if (response.last || response.empty || response.content.length === 0) {
                    break
                }

                page += 1
            }

            return all
        },
        enabled: !!star?.id,
    })

    const connectedItems = snapsQuery.data ?? []

    const snaps = useMemo(() => connectedItems.map(toSnapCard), [connectedItems])

    const feedItemMap = useMemo(
        () => Object.fromEntries(connectedItems.map((item) => [item.snapData.snapId, item])),
        [connectedItems],
    )

    const handleSnapClick = useCallback(
        (snap: Snap) => {
            const feedItem = feedItemMap[snap.id]
            navigate(`/snap/${snap.id}`, { state: { feedItem } })
        },
        [feedItemMap, navigate],
    )

    const stats = useMemo(() => {
        const snapCount = connectedItems.length
        const likeCount = connectedItems.reduce((sum, item) => sum + getLikeCount(item), 0)

        return {
            snapCountText: snapCount.toLocaleString('ko-KR'),
            likeCountText: likeCount.toLocaleString('ko-KR'),
        }
    }, [connectedItems])

    const fanStateQuery = useQuery({
        queryKey: ['fan-state', star?.id ?? ''],
        queryFn: () => getFanState(star!.id),
        enabled: !!star?.id,
    })
    const fanJoined = fanStateQuery.data

    if (loading) {
        return (
            <div className="px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
                <StarProfileHeaderSkeleton />
            </div>
        )
    }

    if (!star) {
        return <Navigate to="/star" replace />
    }

    const profileMetaParts = [star.birthday ? `생일 ${star.birthday}` : null].filter(
        Boolean,
    ) as string[]

    const resolvedStarGroupId = (() => {
        if (star.starGroup?.id) return star.starGroup.id
        const targetName = star.starGroup?.name?.trim()
        if (!targetName) return ''
        const matched = (starGroupsQuery.data ?? []).find(
            (group: StarGroupSearchItem) => group.name.trim() === targetName,
        )
        return matched?.id ?? ''
    })()

    const goToStarGroup = () => {
        if (!resolvedStarGroupId) return
        navigate(`/stargroup/${resolvedStarGroupId}`)
    }

    const groupLinkLoading =
        !star.starGroup?.id &&
        !!star.starGroup?.name?.trim() &&
        starGroupsQuery.isLoading
    const profileHeaderLoading = snapsQuery.isLoading || fanStateQuery.isLoading || groupLinkLoading

    const handleFanToggle = async () => {
        if (!star.id || fanLoading || typeof fanJoined !== 'boolean') return
        setFanLoading(true)

        try {
            if (fanJoined) {
                await disconnectFan(star.id)
                queryClient.setQueryData(['fan-state', star.id], false)
            } else {
                await joinFan(star.id)
                queryClient.setQueryData(['fan-state', star.id], true)
            }
        } catch {
            window.alert('팬 등록 처리에 실패했습니다.')
        } finally {
            setFanLoading(false)
        }
    }

    return (
        <div className="px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
            {profileHeaderLoading ? (
                <StarProfileHeaderSkeleton />
            ) : (
                <ProfileHeader
                    name={star.name}
                    imageKey={star.imageKey}
                    lines={[
                        resolvedStarGroupId ? (
                            <>
                                <button
                                    type="button"
                                    onClick={goToStarGroup}
                                    className="font-medium text-ink underline underline-offset-2 hover:text-brand cursor-pointer"
                                >
                                    {star.starGroup?.name || '-'}
                                </button>
                                <span>{` · ${star.nickname || '-'}`}</span>
                            </>
                        ) : (
                            `${star.starGroup?.name || '-'} · ${star.nickname || '-'}`
                        ),
                        profileMetaParts.join(' · '),
                    ]}
                    stats={[
                        { value: snapsQuery.isError ? '-' : stats.snapCountText, label: '스냅' },
                        { value: '-', label: '팬' },
                        { value: snapsQuery.isError ? '-' : stats.likeCountText, label: '좋아요' },
                    ]}
                    actions={[
                        ...(typeof fanJoined === 'boolean'
                            ? [
                                  {
                                      label: fanLoading ? '처리 중...' : fanJoined ? '팬 취소' : '팬 추가',
                                      variant: 'primary' as const,
                                      onClick: () => {
                                          void handleFanToggle()
                                      },
                                  },
                              ]
                            : []),
                        { label: '공유', variant: 'outline' },
                    ]}
                />
            )}

            <div className="mt-6">
                <Tabs items={tabs} active={tab} onChange={setTab} />
            </div>

            <div className="mt-6">
                {tab === '스냅' ? (
                    snapsQuery.isError ? (
                        <p className="text-sm text-danger">스타 스냅을 불러오지 못했습니다.</p>
                    ) : snapsQuery.isLoading ? (
                        <MasonryGrid snaps={[]} showAuthor={false} isLoading />
                    ) : snaps.length === 0 ? (
                        <p className="text-sm text-sub">이 스타와 연결된 스냅이 없습니다.</p>
                    ) : (
                        <MasonryGrid snaps={snaps} showAuthor={false} onSnapClick={handleSnapClick} />
                    )
                ) : (
                    <p className="text-sm text-sub">{star.explanation || '등록된 스타 소개가 없습니다.'}</p>
                )}
            </div>
        </div>
    )
}

export default StarSnapPage
