import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import CategoryChips from '../../components/ui/CategoryChips'
import MasonryGrid from '../../components/ui/MasonryGrid'
import { categories, getPhotoAspectRatio, type Snap } from '../../constant/mock/snaps'
import { getFeedSnaps, getTrendingTags, type SnapFeedItem } from '../../services/snapService'
import { queryKeys } from '../../services/queryKeys'

const toSnapCard = (item: SnapFeedItem, index: number): Snap => ({
    id: item.snapData.snapId,
    author: item.createdUser.username,
    authorImageKey: item.createdUser.imageKey ?? null,
    aspectRatio: getPhotoAspectRatio(item.snapData.photos?.[0], index),
    photoKey: item.snapData.photos?.[0]?.fileKey,
    liked: !!item.snapData.likeState,
})

const tagSkeletonWidths = ['w-16', 'w-20', 'w-14', 'w-24', 'w-16'] as const

const TrendingTagSkeleton: React.FC = () => (
    <div
        className="flex flex-wrap gap-2"
        role="status"
        aria-busy="true"
        aria-label="인기 태그 불러오는 중"
    >
        {tagSkeletonWidths.map((width, index) => (
            <span
                key={`${width}-${index}`}
                className={`h-11 ${width} rounded-full bg-placeholder animate-pulse`}
                aria-hidden="true"
            />
        ))}
    </div>
)

const HomePage: React.FC = () => {
    const navigate = useNavigate()
    const [active, setActive] = useState('전체')
    const feedQuery = useQuery({
        queryKey: queryKeys.feedSnaps(0, 24),
        queryFn: () => getFeedSnaps(0, 24),
    })
    const trendingTagsQuery = useQuery({
        queryKey: queryKeys.trendingTags(8),
        queryFn: () => getTrendingTags(8),
    })

    const feedItems = feedQuery.data?.content ?? []
    const chipItems = useMemo(() => {
        const tags = trendingTagsQuery.data ?? []
        const uniqueTags = Array.from(new Set(tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0)))
        if (uniqueTags.length === 0) {
            return categories
        }

        return ['전체', ...uniqueTags]
    }, [trendingTagsQuery.data])

    useEffect(() => {
        if (!chipItems.includes(active)) {
            setActive('전체')
        }
    }, [chipItems, active])

    const snaps = useMemo(() => {
        if (feedItems.length === 0) return []

        const filtered =
            active === '전체'
                ? feedItems
                : feedItems.filter((item) => item.snapData.tags?.includes(active))

        return filtered.map(toSnapCard)
    }, [active, feedItems])

    const feedItemMap = useMemo(
        () => Object.fromEntries(feedItems.map((fi) => [fi.snapData.snapId, fi])),
        [feedItems],
    )

    const handleSnapClick = useCallback(
        (snap: Snap) => {
            const feedItem = feedItemMap[snap.id]
            navigate(`/snap/${snap.id}`, { state: { feedItem } })
        },
        [feedItemMap, navigate],
    )

    return (
        <div className="px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
            <h1 className="text-2xl font-bold text-ink">홈</h1>
            <p className="mt-1 text-sm text-sub">팔로우한 스타들의 최신 스냅을 둘러보세요</p>

            <div className="mt-6">
                {trendingTagsQuery.isLoading ? (
                    <TrendingTagSkeleton />
                ) : (
                    <CategoryChips items={chipItems} active={active} onChange={setActive} />
                )}
            </div>

            <div className="mt-6">
                <MasonryGrid
                    snaps={snaps}
                    onSnapClick={handleSnapClick}
                    isLoading={feedQuery.isLoading}
                />
            </div>
        </div>
    )
}

export default HomePage
