import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { SearchIcon } from '../../components/icons'
import CategoryChips from '../../components/ui/CategoryChips'
import MasonryGrid from '../../components/ui/MasonryGrid'
import { getFallbackAspectRatio, getPhotoAspectRatio, type Snap } from '../../constant/mock/snaps'
import {
    getFeedSnaps,
    getPopularSearchKeywords,
    getSnaps,
    searchStars,
    searchStarGroups,
    searchUsers,
    toStarRouteKey,
    type SnapFeedItem,
    type StarSearchItem,
    type StarGroupSearchItem,
    type UserSearchItem,
} from '../../services/snapService'
import { queryKeys } from '../../services/queryKeys'
import { applyNextImageCandidate, getImageCandidates } from '../../utils/s3Image'

const fallbackTrending: string[] = []

const toSnapCard = (item: SnapFeedItem, index: number): Snap => ({
    id: item.snapData.snapId,
    author: item.createdUser.username,
    authorImageKey: item.createdUser.imageKey ?? null,
    aspectRatio: getPhotoAspectRatio(item.snapData.photos?.[0], index),
    photoKey: item.snapData.photos?.[0]?.fileKey,
    liked: !!item.snapData.likeState,
})

const toSnapItemMap = (items: SnapFeedItem[]) =>
    Object.fromEntries(items.map((item) => [item.snapData.snapId, item]))

const EXPLORE_TABS = ['전체', '유저', '스타', '스타그룹', '스냅'] as const
type ExploreTab = (typeof EXPLORE_TABS)[number]

const PREVIEW_SIZE = 6
const FULL_SIZE = 48
const keywordSkeletonWidths = ['w-16', 'w-20', 'w-14', 'w-24'] as const
const previewEntitySections = ['w-12', 'w-14', 'w-20'] as const
const previewEntityCards = Array.from({ length: 3 })
const previewSnapCards = Array.from({ length: PREVIEW_SIZE })

const PopularKeywordSkeleton: React.FC = () => (
    <div
        className="mt-4 flex flex-wrap items-center gap-2"
        role="status"
        aria-busy="true"
        aria-label="인기 검색어 불러오는 중"
    >
        <span className="mr-1 h-4 w-20 rounded bg-placeholder animate-pulse" aria-hidden="true" />
        {keywordSkeletonWidths.map((width, index) => (
            <span
                key={`${width}-${index}`}
                className={`h-11 ${width} rounded-full bg-placeholder animate-pulse`}
                aria-hidden="true"
            />
        ))}
    </div>
)

const SearchPreviewSkeleton: React.FC = () => (
    <div className="space-y-8" role="status" aria-busy="true" aria-label="통합 검색 결과 불러오는 중">
        {previewEntitySections.map((headingWidth, sectionIndex) => (
            <section key={`${headingWidth}-${sectionIndex}`} aria-hidden="true">
                <span className={`mb-3 block h-6 ${headingWidth} rounded bg-placeholder animate-pulse`} />
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {previewEntityCards.map((_, cardIndex) => (
                        <div
                            key={cardIndex}
                            className="rounded-2xl border border-line bg-panel p-5 animate-pulse"
                        >
                            <div className="flex items-center gap-4">
                                <span className="h-14 w-14 shrink-0 rounded-full bg-placeholder" />
                                <div className="min-w-0 flex-1 space-y-2">
                                    <span className="block h-5 w-2/5 rounded bg-placeholder" />
                                    <span className="block h-3.5 w-3/5 rounded bg-placeholder" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        ))}

        <section aria-hidden="true">
            <span className="mb-3 block h-6 w-14 rounded bg-placeholder animate-pulse" />
            <div className="snap-masonry columns-2 md:columns-3 xl:columns-5">
                {previewSnapCards.map((_, index) => (
                    <div key={index} className="overflow-hidden rounded-2xl border border-line bg-panel">
                        <div className="animate-pulse">
                            <div className="bg-placeholder" style={{ aspectRatio: getFallbackAspectRatio(index) }} />
                            <div className="flex items-center gap-2 px-3 py-2.5">
                                <span className="h-6 w-6 shrink-0 rounded-full bg-placeholder" />
                                <span className="h-3 w-20 rounded bg-placeholder" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    </div>
)

const SearchEntityListSkeleton: React.FC<{
    label: string
    secondary?: boolean
}> = ({ label, secondary = false }) => (
    <div
        className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
        role="status"
        aria-label={label}
        aria-busy="true"
    >
        {Array.from({ length: 9 }).map((_, index) => (
            <div
                key={index}
                className="rounded-2xl border border-line bg-panel p-5 animate-pulse"
                aria-hidden="true"
            >
                <div className="flex h-14 items-center gap-4">
                    <span className="h-14 w-14 shrink-0 rounded-full bg-placeholder" />
                    <div className="min-w-0 flex-1 space-y-2">
                        <span className="block h-5 w-2/5 rounded bg-placeholder" />
                        {secondary && <span className="block h-3.5 w-3/5 rounded bg-placeholder" />}
                    </div>
                </div>
            </div>
        ))}
    </div>
)

const EmptyMessage: React.FC<{ text: string }> = ({ text }) => (
    <p className="text-sm text-sub">{text}</p>
)

const UserResultCard: React.FC<{ user: UserSearchItem; onClick: () => void }> = ({ user, onClick }) => {
    const imageCandidates = getImageCandidates(user.profileImageUrl)
    return (
        <button
            onClick={onClick}
            className="text-left rounded-2xl border border-line bg-panel p-5 hover:shadow-sm hover:-translate-y-0.5 transition"
        >
            <div className="flex items-center gap-4">
                {imageCandidates.length > 0 ? (
                    <img
                        src={imageCandidates[0]}
                        alt={`${user.username} 프로필`}
                        width={56}
                        height={56}
                        loading="lazy"
                        className="w-14 h-14 rounded-full object-cover shrink-0"
                        onError={(e) => applyNextImageCandidate(e.currentTarget, imageCandidates)}
                    />
                ) : (
                    <span className="w-14 h-14 rounded-full bg-placeholder shrink-0" />
                )}
                <p className="text-lg font-bold text-ink truncate">{user.username}</p>
            </div>
        </button>
    )
}

const StarResultCard: React.FC<{ star: StarSearchItem; onClick: () => void }> = ({ star, onClick }) => {
    const imageCandidates = getImageCandidates(star.imageKey)
    return (
        <button
            onClick={onClick}
            className="text-left rounded-2xl border border-line bg-panel p-5 hover:shadow-sm hover:-translate-y-0.5 transition"
        >
            <div className="flex items-center gap-4">
                {imageCandidates.length > 0 ? (
                    <img
                        src={imageCandidates[0]}
                        alt={`${star.name} 프로필`}
                        width={56}
                        height={56}
                        loading="lazy"
                        className="w-14 h-14 rounded-full object-cover shrink-0"
                        onError={(e) => applyNextImageCandidate(e.currentTarget, imageCandidates)}
                    />
                ) : (
                    <span className="w-14 h-14 rounded-full bg-placeholder shrink-0" />
                )}
                <div className="min-w-0">
                    <p className="text-lg font-bold text-ink truncate">{star.name}</p>
                    <p className="text-sm text-sub truncate">
                        {star.starGroup?.name || '-'} · {star.nickname || '-'}
                    </p>
                </div>
            </div>
        </button>
    )
}

const StarGroupResultCard: React.FC<{ group: StarGroupSearchItem; onClick: () => void }> = ({ group, onClick }) => {
    const imageCandidates = getImageCandidates(group.imageKey)
    return (
        <button
            onClick={onClick}
            className="text-left rounded-2xl border border-line bg-panel p-5 hover:shadow-sm hover:-translate-y-0.5 transition"
        >
            <div className="flex items-center gap-4">
                {imageCandidates.length > 0 ? (
                    <img
                        src={imageCandidates[0]}
                        alt={`${group.name} 이미지`}
                        width={56}
                        height={56}
                        loading="lazy"
                        className="w-14 h-14 rounded-full object-cover shrink-0"
                        onError={(e) => applyNextImageCandidate(e.currentTarget, imageCandidates)}
                    />
                ) : (
                    <span className="w-14 h-14 rounded-full bg-placeholder shrink-0" />
                )}
                <p className="text-lg font-bold text-ink truncate">{group.name}</p>
            </div>
        </button>
    )
}

const SearchPage: React.FC = () => {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const requestedTab = searchParams.get('tab') as ExploreTab | null
    const query = searchParams.get('q') ?? ''
    const tab: ExploreTab = requestedTab && EXPLORE_TABS.includes(requestedTab) ? requestedTab : '전체'
    const [debouncedQuery, setDebouncedQuery] = useState('')
    const setQuery = useCallback((value: string) => {
        setSearchParams((current) => {
            const next = new URLSearchParams(current)
            if (value.trim()) next.set('q', value)
            else next.delete('q')
            return next
        }, { replace: true })
    }, [setSearchParams])
    const setTab = useCallback((value: ExploreTab) => {
        setSearchParams((current) => {
            const next = new URLSearchParams(current)
            if (value === '전체') next.delete('tab')
            else next.set('tab', value)
            return next
        }, { replace: true })
    }, [setSearchParams])

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(query.trim()), 250)
        return () => clearTimeout(timer)
    }, [query])

    const isSearching = debouncedQuery.length > 0
    const previewEnabled = tab === '전체' && isSearching

    const popularKeywordsQuery = useQuery({
        queryKey: queryKeys.popularSearchKeywords(8),
        queryFn: () => getPopularSearchKeywords(8),
    })
    const feedQuery = useQuery({
        queryKey: queryKeys.feedSnaps(0, 24),
        queryFn: () => getFeedSnaps(0, 24),
        enabled: tab === '전체' && !isSearching,
    })

    // '전체' 탭에서 검색 중일 때 보여줄 유형별 미리보기
    const usersPreviewQuery = useQuery({
        queryKey: queryKeys.users(debouncedQuery, 0, PREVIEW_SIZE),
        queryFn: () => searchUsers(debouncedQuery, 0, PREVIEW_SIZE),
        enabled: previewEnabled,
    })
    const starsPreviewQuery = useQuery({
        queryKey: queryKeys.stars(debouncedQuery, 0, PREVIEW_SIZE),
        queryFn: () => searchStars(debouncedQuery, 0, PREVIEW_SIZE),
        enabled: previewEnabled,
    })
    const starGroupsPreviewQuery = useQuery({
        queryKey: queryKeys.starGroups(debouncedQuery, 0, PREVIEW_SIZE),
        queryFn: () => searchStarGroups(debouncedQuery, 0, PREVIEW_SIZE),
        enabled: previewEnabled,
    })
    const snapsPreviewQuery = useQuery({
        queryKey: queryKeys.snapsByTitle(debouncedQuery, 0, PREVIEW_SIZE),
        queryFn: () =>
            getSnaps({
                size: PREVIEW_SIZE,
                page: 0,
                tag: [],
                title: debouncedQuery,
                user: null,
                starId: [],
                starGroupId: [],
            }),
        enabled: previewEnabled,
    })

    // 개별 탭에서 보여줄 유형별 전체 목록
    const usersFullQuery = useQuery({
        queryKey: queryKeys.users(debouncedQuery, 0, FULL_SIZE),
        queryFn: () => searchUsers(debouncedQuery, 0, FULL_SIZE),
        enabled: tab === '유저',
    })
    const starsFullQuery = useQuery({
        queryKey: queryKeys.stars(debouncedQuery, 0, FULL_SIZE),
        queryFn: () => searchStars(debouncedQuery, 0, FULL_SIZE),
        enabled: tab === '스타',
    })
    const starGroupsFullQuery = useQuery({
        queryKey: queryKeys.starGroups(debouncedQuery, 0, FULL_SIZE),
        queryFn: () => searchStarGroups(debouncedQuery, 0, FULL_SIZE),
        enabled: tab === '스타그룹',
    })
    const snapsFullQuery = useQuery({
        queryKey: queryKeys.snapsByTitle(debouncedQuery, 0, FULL_SIZE),
        queryFn: () =>
            getSnaps({
                size: FULL_SIZE,
                page: 0,
                tag: [],
                title: debouncedQuery,
                user: null,
                starId: [],
                starGroupId: [],
            }),
        enabled: tab === '스냅',
    })

    const trending =
        popularKeywordsQuery.data && popularKeywordsQuery.data.length > 0
            ? popularKeywordsQuery.data
            : fallbackTrending

    const feedItems = feedQuery.data?.content ?? []
    const feedSnaps: Snap[] = feedItems.map(toSnapCard)
    const feedItemMap = useMemo(() => toSnapItemMap(feedItems), [feedItems])

    const snapsPreviewItems = snapsPreviewQuery.data?.content ?? []
    const snapsPreviewSnaps: Snap[] = snapsPreviewItems.map(toSnapCard)
    const snapsPreviewItemMap = useMemo(() => toSnapItemMap(snapsPreviewItems), [snapsPreviewItems])

    const snapsFullItems = snapsFullQuery.data?.content ?? []
    const snapsFullSnaps: Snap[] = snapsFullItems.map(toSnapCard)
    const snapsFullItemMap = useMemo(() => toSnapItemMap(snapsFullItems), [snapsFullItems])

    const handleSnapClick = useCallback(
        (snap: Snap, itemMap: Record<string, SnapFeedItem>) => {
            const feedItem = itemMap[snap.id]
            navigate(`/snap/${snap.id}`, { state: { feedItem } })
        },
        [navigate],
    )

    const usersPreview = usersPreviewQuery.data ?? []
    const starsPreview = starsPreviewQuery.data ?? []
    const starGroupsPreview = starGroupsPreviewQuery.data ?? []
    const previewLoading =
        usersPreviewQuery.isLoading ||
        starsPreviewQuery.isLoading ||
        starGroupsPreviewQuery.isLoading ||
        snapsPreviewQuery.isLoading
    const hasPreviewResults =
        usersPreview.length > 0 ||
        starsPreview.length > 0 ||
        starGroupsPreview.length > 0 ||
        snapsPreviewItems.length > 0

    const usersFull = usersFullQuery.data ?? []
    const starsFull = starsFullQuery.data ?? []
    const starGroupsFull = starGroupsFullQuery.data ?? []

    return (
        <div className="px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
            <h1 className="text-2xl font-bold text-ink">탐색</h1>
            <p className="mt-1 text-sm text-sub">스타, 유저, 스냅을 검색해보세요</p>

            <div className="mt-5 max-w-2xl">
                <div className="relative">
                    <label htmlFor="search-query" className="sr-only">스타, 유저, 스냅 검색</label>
                    <SearchIcon size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                        id="search-query"
                        name="query"
                        autoComplete="off"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full h-12 rounded-full border border-line bg-panel pl-12 pr-4 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-brand"
                        placeholder="예: 좋아하는 스타나 스냅을 검색해 보세요…"
                    />
                </div>

                {tab === '전체' && !isSearching && (
                    popularKeywordsQuery.isLoading ? (
                        <PopularKeywordSkeleton />
                    ) : (
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            <span className="text-sm text-muted mr-1">인기 검색어</span>
                            {trending.map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setQuery(t)}
                                    className="min-h-11 px-4 rounded-full bg-surface text-sub text-sm border border-line hover:bg-panel"
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    )
                )}
            </div>

            <div className="mt-7">
                <CategoryChips items={[...EXPLORE_TABS]} active={tab} onChange={(value) => setTab(value as ExploreTab)} />
            </div>

            <div className="mt-6">
                {tab === '전체' &&
                    (isSearching ? (
                        <div className="space-y-8">
                            {previewLoading ? (
                                <SearchPreviewSkeleton />
                            ) : !hasPreviewResults ? (
                                <EmptyMessage text={`'${debouncedQuery}'에 대한 검색 결과가 없습니다.`} />
                            ) : (
                                <>
                                    {usersPreview.length > 0 && (
                                        <section>
                                            <div className="flex items-center justify-between mb-3">
                                                <h2 className="text-lg font-bold text-ink">유저</h2>
                                                <button className="text-sm text-sub hover:text-ink" onClick={() => setTab('유저')}>
                                                    더보기
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                                {usersPreview.map((user) => (
                                                    <UserResultCard
                                                        key={user.userId}
                                                        user={user}
                                                        onClick={() => navigate(`/user/${encodeURIComponent(user.username)}`)}
                                                    />
                                                ))}
                                            </div>
                                        </section>
                                    )}

                                    {starsPreview.length > 0 && (
                                        <section>
                                            <div className="flex items-center justify-between mb-3">
                                                <h2 className="text-lg font-bold text-ink">스타</h2>
                                                <button className="text-sm text-sub hover:text-ink" onClick={() => setTab('스타')}>
                                                    더보기
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                                {starsPreview.map((star) => (
                                                    <StarResultCard
                                                        key={`${star.id || 'name'}-${star.name}-${star.nickname || ''}`}
                                                        star={star}
                                                        onClick={() => navigate(`/star/${toStarRouteKey(star)}`)}
                                                    />
                                                ))}
                                            </div>
                                        </section>
                                    )}

                                    {starGroupsPreview.length > 0 && (
                                        <section>
                                            <div className="flex items-center justify-between mb-3">
                                                <h2 className="text-lg font-bold text-ink">스타그룹</h2>
                                                <button className="text-sm text-sub hover:text-ink" onClick={() => setTab('스타그룹')}>
                                                    더보기
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                                {starGroupsPreview.map((group) => (
                                                    <StarGroupResultCard
                                                        key={group.id}
                                                        group={group}
                                                        onClick={() => navigate(`/stargroup/${group.id}`)}
                                                    />
                                                ))}
                                            </div>
                                        </section>
                                    )}

                                    {snapsPreviewItems.length > 0 && (
                                        <section>
                                            <div className="flex items-center justify-between mb-3">
                                                <h2 className="text-lg font-bold text-ink">스냅</h2>
                                                <button className="text-sm text-sub hover:text-ink" onClick={() => setTab('스냅')}>
                                                    더보기
                                                </button>
                                            </div>
                                            <MasonryGrid
                                                snaps={snapsPreviewSnaps}
                                                onSnapClick={(snap) => handleSnapClick(snap, snapsPreviewItemMap)}
                                                isLoading={false}
                                            />
                                        </section>
                                    )}
                                </>
                            )}
                        </div>
                    ) : (
                        <MasonryGrid
                            snaps={feedSnaps}
                            onSnapClick={(snap) => handleSnapClick(snap, feedItemMap)}
                            isLoading={feedQuery.isLoading}
                        />
                    ))}

                {tab === '유저' &&
                    (usersFullQuery.isLoading ? (
                        <SearchEntityListSkeleton label="유저 검색 결과를 불러오는 중" />
                    ) : usersFull.length === 0 ? (
                        <EmptyMessage text="표시할 유저가 없습니다." />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                            {usersFull.map((user) => (
                                <UserResultCard
                                    key={user.userId}
                                    user={user}
                                    onClick={() => navigate(`/user/${encodeURIComponent(user.username)}`)}
                                />
                            ))}
                        </div>
                    ))}

                {tab === '스타' &&
                    (starsFullQuery.isLoading ? (
                        <SearchEntityListSkeleton label="스타 검색 결과를 불러오는 중" secondary />
                    ) : starsFull.length === 0 ? (
                        <EmptyMessage text="표시할 스타가 없습니다." />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                            {starsFull.map((star) => (
                                <StarResultCard
                                    key={`${star.id || 'name'}-${star.name}-${star.nickname || ''}`}
                                    star={star}
                                    onClick={() => navigate(`/star/${toStarRouteKey(star)}`)}
                                />
                            ))}
                        </div>
                    ))}

                {tab === '스타그룹' &&
                    (starGroupsFullQuery.isLoading ? (
                        <SearchEntityListSkeleton label="스타그룹 검색 결과를 불러오는 중" />
                    ) : starGroupsFull.length === 0 ? (
                        <EmptyMessage text="표시할 스타그룹이 없습니다." />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                            {starGroupsFull.map((group) => (
                                <StarGroupResultCard
                                    key={group.id}
                                    group={group}
                                    onClick={() => navigate(`/stargroup/${group.id}`)}
                                />
                            ))}
                        </div>
                    ))}

                {tab === '스냅' && (
                    <MasonryGrid
                        snaps={snapsFullSnaps}
                        onSnapClick={(snap) => handleSnapClick(snap, snapsFullItemMap)}
                        isLoading={snapsFullQuery.isLoading}
                    />
                )}
            </div>
        </div>
    )
}

export default SearchPage
