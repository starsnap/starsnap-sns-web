import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import ProfileHeader from '../../components/ui/ProfileHeader'
import Tabs from '../../components/ui/Tabs'
import MasonryGrid from '../../components/ui/MasonryGrid'
import { EntityProfileHeaderSkeleton } from '../../components/ui/EntitySkeletons'
import { MoreIcon } from '../../components/icons'
import { getPhotoAspectRatio, makeSnaps, type Snap } from '../../constant/mock/snaps'
import {
    acceptFriendRequest,
    cancelFriendRequest,
    getAllSnaps,
    getMyFriends,
    getMyProfile,
    getMySnaps,
    getReceivedFriendRequests,
    getSentFriendRequests,
    reportUser,
    getSavedSnaps,
    getUserProfileByUsername,
    rejectFriendRequest,
    sendFriendRequest,
    unfriend,
    type FriendItem,
    type SnapFeedItem,
    type UserProfileResponse,
} from '../../services/snapService'
import { queryKeys } from '../../services/queryKeys'

const fallbackSnaps = makeSnaps(15, 7)

type ReportReason = {
    id: string
    label: string
    detail: string
}

const REPORT_REASONS: ReportReason[] = [
    { id: 'impersonation', label: '사칭 계정', detail: '다른 사람, 기관, 브랜드를 사칭한 계정입니다.' },
    { id: 'spam', label: '스팸/광고', detail: '반복적인 광고 또는 스팸성 활동을 하는 계정입니다.' },
    { id: 'abuse', label: '모욕/비방', detail: '타인을 모욕하거나 공격하는 행위를 하는 계정입니다.' },
    { id: 'privacy', label: '개인정보 침해', detail: '개인정보를 무단으로 노출하거나 악용하는 계정입니다.' },
    { id: 'other', label: '기타', detail: '운영정책 위반이 의심되는 기타 사유입니다.' },
]

const toSnapCard = (item: SnapFeedItem, index: number): Snap => ({
    id: item.snapData.snapId,
    author: item.createdUser.username,
    authorImageKey: item.createdUser.imageKey ?? null,
    aspectRatio: getPhotoAspectRatio(item.snapData.photos?.[0], index),
    photoKey: item.snapData.photos?.[0]?.fileKey,
    liked: !!item.snapData.likeState,
})

type Props = { own?: boolean }

type FriendRelation = 'NONE' | 'REQUEST_SENT' | 'REQUEST_RECEIVED' | 'FRIEND'

const resolveProfileImageKey = (profile: UserProfileResponse | null): string | null => {
    if (!profile) return null
    const savedKey = profile.profileImageUrl?.trim()
    return savedKey || null
}

const UserPage: React.FC<Props> = ({ own = false }) => {
    const navigate = useNavigate()
    const { username: usernameParam } = useParams<{ username?: string }>()
    const targetUsername = useMemo(
        () => (usernameParam ? decodeURIComponent(usernameParam).trim() : ''),
        [usernameParam],
    )
    const isOtherUserPage = !own && !!targetUsername
    const tabs = own ? ['내 스냅', '저장됨'] : ['스냅']
    const [tab, setTab] = useState(tabs[0])
    const [friendActionSubmitting, setFriendActionSubmitting] = useState(false)
    const [reportSheetOpen, setReportSheetOpen] = useState(false)
    const [reportMenuOpen, setReportMenuOpen] = useState(false)
    const [selectedReportReason, setSelectedReportReason] = useState<ReportReason | null>(null)
    const [reportSubmitting, setReportSubmitting] = useState(false)
    const [reportError, setReportError] = useState('')
    const reportMenuRef = useRef<HTMLDivElement | null>(null)
    const profileQuery = useQuery<UserProfileResponse>({
        queryKey: queryKeys.myProfile,
        queryFn: getMyProfile,
        enabled: own || isOtherUserPage,
    })
    const mySnapsQuery = useQuery<SnapFeedItem[]>({
        queryKey: queryKeys.mySnaps(0, 100),
        queryFn: () => getMySnaps(0, 100),
        enabled: own,
    })
    const savedSnapsQuery = useQuery<SnapFeedItem[]>({
        queryKey: queryKeys.savedSnaps,
        queryFn: getSavedSnaps,
        enabled: own,
    })
    const otherUserSnapsQuery = useQuery<SnapFeedItem[]>({
        queryKey: ['user-snaps', targetUsername],
        queryFn: () => getAllSnaps(100),
        enabled: isOtherUserPage,
    })
    const otherUserProfileQuery = useQuery<UserProfileResponse>({
        queryKey: ['user-profile-by-username', targetUsername],
        queryFn: () => getUserProfileByUsername(targetUsername),
        enabled: isOtherUserPage,
    })
    const friendsQuery = useQuery<FriendItem[]>({
        queryKey: queryKeys.myFriends(200),
        queryFn: () => getMyFriends(0, 200),
        enabled: isOtherUserPage,
    })
    const receivedRequestsQuery = useQuery<FriendItem[]>({
        queryKey: queryKeys.myReceivedFriendRequests(200),
        queryFn: () => getReceivedFriendRequests(0, 200),
        enabled: isOtherUserPage,
    })
    const sentRequestsQuery = useQuery<FriendItem[]>({
        queryKey: queryKeys.mySentFriendRequests(200),
        queryFn: () => getSentFriendRequests(0, 200),
        enabled: isOtherUserPage,
    })

    const relationLoading =
        isOtherUserPage &&
        (friendsQuery.isLoading || receivedRequestsQuery.isLoading || sentRequestsQuery.isLoading)
    const headerLoading = own
        ? profileQuery.isLoading
        : isOtherUserPage &&
          (profileQuery.isLoading || otherUserProfileQuery.isLoading || relationLoading)
    const contentLoading = own
        ? tab === '저장됨'
            ? savedSnapsQuery.isLoading
            : mySnapsQuery.isLoading
        : isOtherUserPage &&
          (profileQuery.isLoading ||
              otherUserSnapsQuery.isLoading ||
              otherUserProfileQuery.isLoading ||
              relationLoading)
    const error =
        (own &&
            (profileQuery.isError ||
                (tab === '저장됨' ? savedSnapsQuery.isError : mySnapsQuery.isError))) ||
        (isOtherUserPage &&
            (otherUserSnapsQuery.isError ||
                otherUserProfileQuery.isError ||
                friendsQuery.isError ||
                receivedRequestsQuery.isError ||
                sentRequestsQuery.isError))
            ? '프로필 스냅을 불러오지 못했습니다.'
            : ''
    const profile = own ? profileQuery.data ?? null : null
    const isOwnUserRoute =
        isOtherUserPage &&
        profileQuery.data?.username === targetUsername
    const myItems = own ? mySnapsQuery.data ?? [] : []
    const savedItems = own ? savedSnapsQuery.data ?? [] : []
    const otherUserItems = useMemo(() => {
        if (!isOtherUserPage) return [] as SnapFeedItem[]
        const allSnaps = otherUserSnapsQuery.data ?? []
        return allSnaps.filter((item) => item.createdUser.username === targetUsername)
    }, [isOtherUserPage, otherUserSnapsQuery.data, targetUsername])

    const otherUserProfileImageKey = useMemo(() => {
        if (!isOtherUserPage) return null
        return (
            otherUserProfileQuery.data?.profileImageUrl?.trim() ||
            otherUserItems[0]?.createdUser?.imageKey ||
            null
        )
    }, [isOtherUserPage, otherUserProfileQuery.data?.profileImageUrl, otherUserItems])

    const relation = useMemo<FriendRelation>(() => {
        if (!isOtherUserPage) return 'NONE'
        const friends = friendsQuery.data ?? []
        if (friends.some((item) => item.username === targetUsername)) return 'FRIEND'
        const receivedRequests = receivedRequestsQuery.data ?? []
        if (receivedRequests.some((item) => item.username === targetUsername)) return 'REQUEST_RECEIVED'
        const sentRequests = sentRequestsQuery.data ?? []
        if (sentRequests.some((item) => item.username === targetUsername)) return 'REQUEST_SENT'
        return 'NONE'
    }, [isOtherUserPage, friendsQuery.data, receivedRequestsQuery.data, sentRequestsQuery.data, targetUsername])

    const isPrivateLocked =
        isOtherUserPage && !!otherUserProfileQuery.data?.isPrivate && relation !== 'FRIEND'

    const refetchFriendQueries = async () => {
        await Promise.all([friendsQuery.refetch(), receivedRequestsQuery.refetch(), sentRequestsQuery.refetch()])
    }

    const handleToggleFriendAction = async () => {
        if (!isOtherUserPage || friendActionSubmitting) return
        const targetUserId = otherUserProfileQuery.data?.userId
        if (!targetUserId) return

        try {
            setFriendActionSubmitting(true)
            if (relation === 'FRIEND') {
                await unfriend(targetUserId)
            } else if (relation === 'REQUEST_SENT') {
                await cancelFriendRequest(targetUserId)
            } else if (relation === 'NONE') {
                await sendFriendRequest(targetUserId)
            }
            await refetchFriendQueries()
        } finally {
            setFriendActionSubmitting(false)
        }
    }

    const handleAcceptFriendRequest = async () => {
        if (!isOtherUserPage || friendActionSubmitting) return
        const targetUserId = otherUserProfileQuery.data?.userId
        if (!targetUserId) return

        try {
            setFriendActionSubmitting(true)
            await acceptFriendRequest(targetUserId)
            await refetchFriendQueries()
        } finally {
            setFriendActionSubmitting(false)
        }
    }

    const handleRejectFriendRequest = async () => {
        if (!isOtherUserPage || friendActionSubmitting) return
        const targetUserId = otherUserProfileQuery.data?.userId
        if (!targetUserId) return

        try {
            setFriendActionSubmitting(true)
            await rejectFriendRequest(targetUserId)
            await refetchFriendQueries()
        } finally {
            setFriendActionSubmitting(false)
        }
    }

    useEffect(() => {
        if (!reportMenuOpen) return

        const handlePointerDown = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node | null
            if (!target) return
            if (!reportMenuRef.current?.contains(target)) {
                setReportMenuOpen(false)
            }
        }

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setReportMenuOpen(false)
        }

        document.addEventListener('mousedown', handlePointerDown)
        document.addEventListener('touchstart', handlePointerDown)
        document.addEventListener('keydown', handleEscape)
        return () => {
            document.removeEventListener('mousedown', handlePointerDown)
            document.removeEventListener('touchstart', handlePointerDown)
            document.removeEventListener('keydown', handleEscape)
        }
    }, [reportMenuOpen])

    const openReportSheet = () => {
        if (!isOtherUserPage) return
        setReportMenuOpen(false)
        setReportError('')
        setSelectedReportReason(null)
        setReportSheetOpen(true)
    }

    const closeReportSheet = () => {
        if (reportSubmitting) return
        setReportSheetOpen(false)
        setSelectedReportReason(null)
        setReportError('')
    }

    const handleSubmitUserReport = async () => {
        if (!isOtherUserPage || reportSubmitting || !selectedReportReason) return
        const targetUserId = otherUserProfileQuery.data?.userId
        if (!targetUserId) {
            setReportError('신고 대상 사용자를 확인할 수 없습니다.')
            return
        }

        try {
            setReportSubmitting(true)
            setReportError('')
            await reportUser(targetUserId, `${selectedReportReason.label} - ${selectedReportReason.detail}`)
            closeReportSheet()
            window.alert('유저 신고가 접수되었습니다.')
        } catch {
            setReportError('신고 접수에 실패했습니다. 잠시 후 다시 시도해주세요.')
        } finally {
            setReportSubmitting(false)
        }
    }

    const snaps = useMemo(() => {
        if (isOtherUserPage) return otherUserItems.map(toSnapCard)
        if (!own) return fallbackSnaps
        if (tab === '저장됨') return savedItems.map(toSnapCard)
        return myItems.map(toSnapCard)
    }, [isOtherUserPage, otherUserItems, own, tab, myItems, savedItems])

    const activeFeedItems = useMemo(() => {
        if (isOtherUserPage) return otherUserItems
        if (!own) return [] as SnapFeedItem[]
        return tab === '저장됨' ? savedItems : myItems
    }, [isOtherUserPage, otherUserItems, own, tab, myItems, savedItems])

    const activeFeedItemMap = useMemo(
        () => Object.fromEntries(activeFeedItems.map((fi) => [fi.snapData.snapId, fi])),
        [activeFeedItems],
    )

    const handleSnapClick = (snap: Snap) => {
        const feedItem = activeFeedItemMap[snap.id]
        if (!feedItem) return
        navigate(`/snap/${snap.id}`, {
            state: {
                feedItem,
                sourcePage: isOtherUserPage ? 'user' : 'profile',
                canEdit: own && tab === '내 스냅',
            },
        })
    }

    if (isOwnUserRoute) {
        return <Navigate to="/profile" replace />
    }

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-5 sm:py-7">
            {headerLoading ? (
                <EntityProfileHeaderSkeleton />
            ) : (
                <ProfileHeader
                    name={isOtherUserPage ? targetUsername : profile?.username ?? '사용자'}
                    imageKey={isOtherUserPage ? otherUserProfileImageKey : resolveProfileImageKey(profile)}
                    lines={[
                        isOtherUserPage
                            ? `@${targetUsername}`
                            : profile
                              ? `@${profile.username}`
                              : '@사용자',
                        '스타스냅 사용자',
                    ]}
                    actions={
                        own
                            ? [
                              {
                                  label: '프로필 수정',
                                  variant: 'outline',
                                  onClick: () => navigate('/profile/edit'),
                              },
                              { label: '공유', variant: 'outline' },
                              {
                                  label: '설정',
                                  variant: 'outline',
                                  onClick: () => navigate('/setting'),
                              },
                          ]
                        : [
                              ...(relation === 'REQUEST_RECEIVED'
                                  ? [
                                        {
                                            label: friendActionSubmitting ? '처리 중...' : '수락',
                                            variant: 'primary' as const,
                                            onClick: () => void handleAcceptFriendRequest(),
                                        },
                                        {
                                            label: friendActionSubmitting ? '처리 중...' : '거절',
                                            variant: 'outline' as const,
                                            onClick: () => void handleRejectFriendRequest(),
                                        },
                                    ]
                                  : [
                                        {
                                            label: friendActionSubmitting
                                                ? '처리 중...'
                                                : relation === 'FRIEND'
                                                  ? '친구 끊기'
                                                  : relation === 'REQUEST_SENT'
                                                    ? '요청 취소'
                                                    : '친구 추가',
                                            variant: relation === 'NONE' ? ('primary' as const) : ('outline' as const),
                                            onClick: () => void handleToggleFriendAction(),
                                        },
                                    ]),
                              ...(isPrivateLocked
                                  ? []
                                  : [
                                        {
                                            label: '메시지',
                                            variant: 'outline' as const,
                                            onClick: () =>
                                                navigate(`/message?user=${encodeURIComponent(targetUsername)}`),
                                        },
                                    ]),
                              ]
                    }
                    actionMenu={
                        isOtherUserPage ? (
                            <div className="relative" ref={reportMenuRef}>
                            <button
                                type="button"
                                className="h-11 w-11 inline-flex items-center justify-center rounded-xl border border-line bg-panel text-sub hover:bg-surface"
                                aria-label="유저 메뉴"
                                onClick={() => setReportMenuOpen((prev) => !prev)}
                            >
                                <MoreIcon size={18} />
                            </button>
                            {reportMenuOpen && (
                                <div className="absolute right-0 mt-2 w-32 rounded-xl border border-line bg-panel shadow-lg p-1.5 z-10">
                                    <button
                                        type="button"
                                        className="w-full text-left px-3 py-2 rounded-lg text-sm text-danger hover:bg-surface"
                                        onClick={openReportSheet}
                                    >
                                        신고하기
                                    </button>
                                </div>
                            )}
                            </div>
                        ) : null
                    }
                />
            )}

            {tabs.length > 1 && (
                <div className="mt-5 sm:mt-6">
                    <Tabs items={tabs} active={tab} onChange={setTab} />
                </div>
            )}

            {contentLoading ? (
                <div className="mt-5 sm:mt-6">
                    <MasonryGrid
                        snaps={[]}
                        showAuthor={false}
                        columnsClass="columns-1 sm:columns-2 lg:columns-3 2xl:columns-5"
                        isLoading
                    />
                </div>
            ) : error ? (
                <p className="mt-8 text-sm text-danger">{error}</p>
            ) : isPrivateLocked ? (
                <p className="mt-8 text-sm text-muted">비공개 계정입니다. 친구가 되면 볼 수 있어요.</p>
            ) : snaps.length === 0 ? (
                <p className="mt-8 text-sm text-muted">표시할 스냅이 없습니다.</p>
            ) : (
                <div className="mt-5 sm:mt-6">
                    <MasonryGrid
                        snaps={snaps}
                        showAuthor={false}
                        columnsClass="columns-1 sm:columns-2 lg:columns-3 2xl:columns-5"
                        onSnapClick={own || isOtherUserPage ? handleSnapClick : undefined}
                    />
                </div>
            )}

            {reportSheetOpen && (
                <div className="fixed inset-0 z-50">
                    <button
                        type="button"
                        className="absolute inset-0 bg-black/35"
                        onClick={closeReportSheet}
                        aria-label="유저 신고 시트 닫기"
                    />
                    <div className="absolute inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center p-0 sm:p-4">
                        <div className="bg-panel rounded-t-3xl sm:rounded-2xl shadow-xl w-full sm:max-w-md p-5 sm:p-6 relative">
                            <button
                                type="button"
                                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-surface text-sub hover:bg-line"
                                onClick={closeReportSheet}
                                aria-label="유저 신고 모달 닫기"
                            >
                                ×
                            </button>

                            <h3 className="text-center text-lg font-bold text-ink mb-2">유저 신고하기</h3>
                            <p className="text-center text-sm text-sub mb-4">사유를 선택해 신고를 접수해주세요.</p>

                            <div className="space-y-2">
                                {REPORT_REASONS.map((reason) => {
                                    const active = selectedReportReason?.id === reason.id
                                    return (
                                        <button
                                            key={reason.id}
                                            type="button"
                                            className={`w-full text-left rounded-xl border p-3 transition ${
                                                active
                                                    ? 'border-brand bg-brand/10'
                                                    : 'border-line hover:border-brand/60 hover:bg-surface'
                                            }`}
                                            onClick={() => {
                                                if (reportSubmitting) return
                                                setSelectedReportReason(reason)
                                            }}
                                        >
                                            <p className="text-sm font-semibold text-ink">{reason.label}</p>
                                            <p className="text-xs text-sub mt-1">{reason.detail}</p>
                                        </button>
                                    )
                                })}
                            </div>

                            <p className="mt-5 text-sm text-ink font-medium">{targetUsername} 님 신고하기</p>
                            {reportError && <p className="mt-2 text-xs text-danger">{reportError}</p>}

                            <button
                                type="button"
                                className="mt-4 w-full h-11 rounded-xl bg-danger text-on-danger text-sm font-bold disabled:opacity-60"
                                onClick={() => void handleSubmitUserReport()}
                                disabled={reportSubmitting || !selectedReportReason}
                            >
                                {reportSubmitting ? '신고 접수 중...' : '신고하기'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default UserPage
