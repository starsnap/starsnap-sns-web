import React, { useCallback, useDeferredValue } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { searchStarGroups, type StarGroupSearchItem } from '../../services/snapService'
import { applyNextImageCandidate, getImageCandidates } from '../../utils/s3Image'
import { queryKeys } from '../../services/queryKeys'
import { SearchIcon } from '../../components/icons'
import { StarGroupListSkeleton } from '../../components/ui/EntitySkeletons'
import StarDirectoryNav from '../../components/star/StarDirectoryNav'

const StarGroupPage: React.FC = () => {
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
    const groupsQuery = useQuery({
        queryKey: queryKeys.starGroups(deferredQuery, 0, 48),
        queryFn: () => searchStarGroups(deferredQuery, 0, 48),
    })
    const groups: StarGroupSearchItem[] = groupsQuery.data ?? []

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
                    placeholder="스타그룹 검색"
                    aria-label="스타그룹 검색"
                />
            </div>

            <div className="mt-5">
                {groupsQuery.isLoading ? (
                    <StarGroupListSkeleton />
                ) : groupsQuery.isError ? (
                    <StateMessage message="스타그룹을 불러오지 못했어요." onRetry={() => void groupsQuery.refetch()} />
                ) : groups.length === 0 ? (
                    <StateMessage message={query ? '검색 결과가 없어요.' : '표시할 스타그룹이 없습니다.'} />
                ) : (
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                        {groups.map((group) => {
                            const imageCandidates = getImageCandidates(group.imageKey)

                            return (
                                <button
                                    key={group.id}
                                    onClick={() => navigate(`/stargroup/${group.id}`)}
                                    className="group relative h-48 overflow-hidden rounded-2xl bg-placeholder text-left transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                                >
                                    {imageCandidates.length > 0 ? (
                                        <img
                                            src={imageCandidates[0]}
                                            alt={`${group.name} 프로필`}
                                            width={640}
                                            height={480}
                                            loading="lazy"
                                            className="absolute inset-0 h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                                            onError={(event) => applyNextImageCandidate(event.currentTarget, imageCandidates)}
                                        />
                                    ) : (
                                        <div className="absolute inset-0 bg-gradient-to-br from-media-backdrop-soft to-media-backdrop" />
                                    )}

                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/5 transition group-hover:from-black/85" />

                                    <div className="absolute inset-0 flex flex-col justify-end p-4 text-on-media">
                                        <div className="space-y-1">
                                            <p className="truncate text-lg font-bold leading-tight">{group.name}</p>
                                            <p className="text-xs text-on-media/80">데뷔 {group.debutDate || '-'}</p>
                                        </div>
                                    </div>
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

export default StarGroupPage
