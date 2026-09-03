import React, { useCallback, useDeferredValue } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
    searchStars,
    toStarRouteKey,
    type StarSearchItem,
} from '../../services/snapService'
import { applyNextImageCandidate, getImageCandidates } from '../../utils/s3Image'
import { queryKeys } from '../../services/queryKeys'
import { SearchIcon } from '../../components/icons'
import { StarListSkeleton } from '../../components/ui/EntitySkeletons'
import StarDirectoryNav from '../../components/star/StarDirectoryNav'

const StarPage: React.FC = () => {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const query = searchParams.get('q') ?? ''
    const setQuery = useCallback((value: string) => {
        setSearchParams((current) => {
            const next = new URLSearchParams(current)
            if (value.trim()) next.set('q', value)
            else next.delete('q')
            return next
        }, { replace: true })
    }, [setSearchParams])
    const deferredQuery = useDeferredValue(query.trim())

    const starsQuery = useQuery({
        queryKey: queryKeys.stars(deferredQuery, 0, 48),
        queryFn: () => searchStars(deferredQuery, 0, 48),
    })

    const stars: StarSearchItem[] = starsQuery.data ?? []

    return (
        <div className="px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
            <StarDirectoryNav />

            <div className="relative">
                <SearchIcon
                    size={22}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                    name="query"
                    autoComplete="off"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-transparent bg-placeholder pl-12 pr-4 text-base text-ink outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/25"
                    placeholder="스타 검색"
                    aria-label="스타 검색"
                />
            </div>

            <div className="mt-5">
                {starsQuery.isLoading ? (
                    <StarListSkeleton />
                ) : starsQuery.isError ? (
                    <StateMessage message="스타를 불러오지 못했어요." onRetry={() => void starsQuery.refetch()} />
                ) : stars.length === 0 ? (
                    <StateMessage message="검색 결과가 없어요." />
                ) : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                        {stars.map((star) => {
                            const imageCandidates = getImageCandidates(star.imageKey)

                            return (
                                <button
                                    key={`${star.id || 'name'}-${star.name}-${star.nickname || ''}`}
                                    onClick={() => navigate(`/star/${toStarRouteKey(star)}`)}
                                    className="min-h-32 rounded-2xl border border-line bg-panel p-5 text-left transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                                >
                                    <div className="flex items-center gap-4">
                                        {imageCandidates.length > 0 ? (
                                            <img
                                                src={imageCandidates[0]}
                                                alt={`${star.name} 프로필`}
                                                width={56}
                                                height={56}
                                                loading="lazy"
                                                className="h-14 w-14 shrink-0 rounded-full object-cover"
                                                onError={(event) =>
                                                    applyNextImageCandidate(event.currentTarget, imageCandidates)
                                                }
                                            />
                                        ) : (
                                            <span className="h-14 w-14 shrink-0 rounded-full bg-placeholder" />
                                        )}
                                        <div className="min-w-0">
                                            <p className="truncate text-lg font-bold text-ink">{star.name}</p>
                                            <p className="truncate text-sm text-sub">
                                                {star.starGroup?.name || '-'} · {star.nickname || '-'}
                                            </p>
                                        </div>
                                    </div>

                                    {star.birthday ? (
                                        <p className="mt-4 text-xs text-sub">생일 {star.birthday}</p>
                                    ) : null}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

const StateMessage: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
    <div className="rounded-2xl border border-line bg-panel px-5 py-8 text-center">
        <p className="text-sm text-sub">{message}</p>
        {onRetry ? (
            <button
                type="button"
                onClick={onRetry}
                className="mt-4 min-h-11 rounded-xl border border-line px-5 text-sm font-bold text-ink hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
                다시 시도
            </button>
        ) : null}
    </div>
)

export default StarPage
