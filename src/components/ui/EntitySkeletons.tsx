import React from 'react'

const skeletonItems = Array.from({ length: 9 })

type SelectionSkeletonVariant = 'star' | 'group'

export const StarListSkeleton: React.FC = () => (
    <div
        className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
        role="status"
        aria-label="스타 목록을 불러오는 중"
        aria-busy="true"
    >
        {skeletonItems.map((_, index) => (
            <div
                key={index}
                className="rounded-2xl border border-line bg-panel p-5 animate-pulse"
                aria-hidden="true"
            >
                <div className="flex items-center gap-4">
                    <span className="h-14 w-14 shrink-0 rounded-full bg-placeholder" />
                    <div className="min-w-0 flex-1 space-y-2">
                        <span className="block h-5 w-2/5 rounded bg-placeholder" />
                        <span className="block h-3.5 w-3/5 rounded bg-placeholder" />
                    </div>
                </div>
                <span className="mt-4 block h-3 w-1/3 rounded bg-placeholder" />
            </div>
        ))}
    </div>
)

export const StarGroupListSkeleton: React.FC = () => (
    <div
        className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
        role="status"
        aria-label="스타그룹 목록을 불러오는 중"
        aria-busy="true"
    >
        {skeletonItems.map((_, index) => (
            <div
                key={index}
                className="relative h-48 overflow-hidden rounded-2xl bg-placeholder animate-pulse"
                aria-hidden="true"
            >
                <div className="absolute inset-x-4 bottom-4 space-y-2">
                    <span className="block h-5 w-2/5 rounded bg-on-media/60" />
                    <span className="block h-3 w-1/3 rounded bg-on-media/45" />
                </div>
            </div>
        ))}
    </div>
)

export const EntityProfileHeaderSkeleton: React.FC = () => (
    <div
        className="rounded-2xl border border-line bg-panel p-4 sm:p-6 animate-pulse"
        role="status"
        aria-label="프로필을 불러오는 중"
        aria-busy="true"
    >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
            <span className="h-20 w-20 shrink-0 rounded-full bg-placeholder sm:h-24 sm:w-24 lg:h-28 lg:w-28" />
            <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:gap-6">
                    <div className="space-y-2">
                        <span className="block h-7 w-40 rounded bg-placeholder" />
                        <span className="block h-4 w-28 rounded bg-placeholder" />
                        <span className="block h-4 w-24 rounded bg-placeholder" />
                    </div>
                </div>
                <div className="mt-4 flex gap-2">
                    <span className="h-10 w-24 rounded-lg bg-placeholder" />
                    <span className="h-10 w-16 rounded-lg bg-placeholder" />
                </div>
            </div>
        </div>
    </div>
)

export const StarGroupHeaderSkeleton: React.FC = () => (
    <div
        className="rounded-2xl bg-placeholder p-7 animate-pulse"
        role="status"
        aria-label="스타그룹 정보를 불러오는 중"
        aria-busy="true"
    >
        <div className="flex items-center gap-6">
            <span className="h-28 w-28 shrink-0 rounded-full border-4 border-on-media/70 bg-on-media/30" />
            <div className="flex-1 space-y-3">
                <span className="block h-8 w-40 rounded bg-on-media/60" />
                <span className="block h-4 w-24 rounded bg-on-media/45" />
            </div>
        </div>
        <div className="mt-6 flex gap-2">
            <span className="h-10 flex-1 rounded-lg bg-on-media/60" />
            <span className="h-10 w-10 rounded-lg bg-on-media/60" />
            <span className="h-10 w-10 rounded-lg bg-on-media/60" />
        </div>
    </div>
)

export const ProfileEditSkeleton: React.FC = () => (
    <div
        className="max-w-[760px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8"
        role="status"
        aria-label="프로필 정보를 불러오는 중"
        aria-busy="true"
    >
        <div className="animate-pulse" aria-hidden="true">
            <span className="block h-4 w-20 rounded bg-placeholder" />
            <span className="mt-5 block h-8 w-32 rounded bg-placeholder" />

            <div className="mt-6 rounded-2xl border border-line bg-panel p-6">
                <div className="flex items-center gap-5">
                    <span className="h-24 w-24 shrink-0 rounded-full bg-placeholder" />
                    <span className="h-10 w-24 rounded-lg bg-placeholder" />
                </div>

                <div className="mt-6 space-y-2">
                    <span className="block h-4 w-16 rounded bg-placeholder" />
                    <span className="block h-11 w-full rounded-lg bg-placeholder" />
                    <span className="block h-3 w-56 max-w-full rounded bg-placeholder" />
                </div>

                <div className="mt-4 space-y-2">
                    <span className="block h-4 w-12 rounded bg-placeholder" />
                    <span className="block h-11 w-full rounded-lg bg-placeholder" />
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <span className="h-11 w-20 rounded-lg bg-placeholder" />
                    <span className="h-11 w-20 rounded-lg bg-placeholder" />
                </div>
            </div>
        </div>
    </div>
)

export const SettingsRowsSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
    <div
        className="divide-y divide-line"
        role="status"
        aria-label="설정 정보를 불러오는 중"
        aria-busy="true"
    >
        {Array.from({ length: count }).map((_, index) => (
            <div key={index} className="flex h-14 animate-pulse items-center justify-between px-5" aria-hidden="true">
                <span className={`h-4 rounded bg-placeholder ${index % 2 === 0 ? 'w-32' : 'w-24'}`} />
                <span className={`h-4 rounded bg-placeholder ${index % 3 === 0 ? 'w-20' : 'w-14'}`} />
            </div>
        ))}
    </div>
)

export const SettingsTableSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
    <div
        className="overflow-x-auto"
        role="status"
        aria-label="문의 내역을 불러오는 중"
        aria-busy="true"
    >
        <div className="min-w-[640px] animate-pulse" aria-hidden="true">
            <div className="grid grid-cols-[minmax(220px,1fr)_120px_180px_minmax(160px,1fr)] gap-4 bg-surface px-4 py-3">
                {Array.from({ length: 4 }).map((_, index) => (
                    <span key={index} className="h-4 w-16 rounded bg-placeholder" />
                ))}
            </div>
            {Array.from({ length: count }).map((_, index) => (
                <div
                    key={index}
                    className="grid grid-cols-[minmax(220px,1fr)_120px_180px_minmax(160px,1fr)] gap-4 border-t border-line px-4 py-4"
                >
                    <span className={`h-4 rounded bg-placeholder ${index % 2 === 0 ? 'w-4/5' : 'w-3/5'}`} />
                    <span className="h-4 w-14 rounded bg-placeholder" />
                    <span className="h-4 w-24 rounded bg-placeholder" />
                    <span className="h-4 w-20 rounded bg-placeholder" />
                </div>
            ))}
        </div>
    </div>
)

export const EntitySelectionGridSkeleton: React.FC<{
    variant?: SelectionSkeletonVariant
    count?: number
}> = ({ variant = 'star', count = 8 }) => (
    <div
        className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
        role="status"
        aria-label={`${variant === 'star' ? '스타' : '스타그룹'} 검색 결과를 불러오는 중`}
        aria-busy="true"
    >
        {Array.from({ length: count }).map((_, index) => (
            <div
                key={index}
                className={`animate-pulse rounded-2xl border border-line p-3 ${
                    variant === 'star' ? 'h-[150px]' : 'h-[120px]'
                }`}
                aria-hidden="true"
            >
                <span
                    className={`mx-auto block h-14 w-14 bg-placeholder ${
                        variant === 'star' ? 'rounded-full' : 'rounded-xl'
                    }`}
                />
                <span className="mx-auto mt-3 block h-4 w-3/4 rounded bg-placeholder" />
                {variant === 'star' && <span className="mx-auto mt-2 block h-3 w-1/2 rounded bg-placeholder" />}
            </div>
        ))}
    </div>
)

export const EntitySelectionStripSkeleton: React.FC<{
    variant?: SelectionSkeletonVariant
    count?: number
}> = ({ variant = 'star', count = 2 }) => (
    <div
        className="flex shrink-0 gap-3"
        role="status"
        aria-label={`${variant === 'star' ? '스타' : '스타그룹'} 정보를 불러오는 중`}
        aria-busy="true"
    >
        {Array.from({ length: count }).map((_, index) => (
            <div
                key={index}
                className={`shrink-0 animate-pulse ${variant === 'star' ? 'w-[92px]' : 'w-[112px]'}`}
                aria-hidden="true"
            >
                <span
                    className={`mx-auto block bg-placeholder ${
                        variant === 'star' ? 'h-[72px] w-[72px] rounded-full' : 'h-[60px] w-[100px] rounded-xl'
                    }`}
                />
                <span className="mx-auto mt-2 block h-3 w-14 rounded bg-placeholder" />
            </div>
        ))}
    </div>
)

export const ChatRoomListSkeleton: React.FC<{ count?: number }> = ({ count = 7 }) => (
    <div role="status" aria-label="대화 목록을 불러오는 중" aria-busy="true">
        {Array.from({ length: count }).map((_, index) => (
            <div key={index} className="flex animate-pulse items-center gap-3 px-4 py-3" aria-hidden="true">
                <span className="h-11 w-11 shrink-0 rounded-full bg-placeholder" />
                <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center justify-between gap-4">
                        <span className={`h-4 rounded bg-placeholder ${index % 2 === 0 ? 'w-28' : 'w-20'}`} />
                        <span className="h-3 w-9 rounded bg-placeholder" />
                    </div>
                    <span className={`block h-3 rounded bg-placeholder ${index % 3 === 0 ? 'w-4/5' : 'w-3/5'}`} />
                </div>
            </div>
        ))}
    </div>
)

const chatMessageWidths = [48, 64, 40, 72, 56, 44]

export const ChatMessageListSkeleton: React.FC<{ count?: number }> = ({ count = chatMessageWidths.length }) => (
    <div className="space-y-3" role="status" aria-label="메시지를 불러오는 중" aria-busy="true">
        {chatMessageWidths.slice(0, count).map((width, index) => (
            <div
                key={`${width}-${index}`}
                className={`flex animate-pulse ${index % 3 === 1 ? 'justify-end' : 'justify-start'}`}
                aria-hidden="true"
            >
                <span
                    className={`h-10 rounded-2xl bg-placeholder ${index % 3 === 1 ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
                    style={{ width: `${width}%` }}
                />
            </div>
        ))}
    </div>
)

export const ChatFriendListSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
    <div
        className="mt-2 max-h-44 divide-y divide-line overflow-hidden rounded-md border border-line bg-panel"
        role="status"
        aria-label="친구 목록을 불러오는 중"
        aria-busy="true"
    >
        {Array.from({ length: count }).map((_, index) => (
            <div key={index} className="flex animate-pulse items-center gap-2 px-3 py-2" aria-hidden="true">
                <span className="h-7 w-7 shrink-0 rounded-full bg-placeholder" />
                <span className={`h-4 rounded bg-placeholder ${index % 2 === 0 ? 'w-28' : 'w-20'}`} />
            </div>
        ))}
    </div>
)
