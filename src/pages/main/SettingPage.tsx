import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRightIcon } from '../../components/icons'
import Toggle from '../../components/ui/Toggle'
import { SettingsRowsSkeleton, SettingsTableSkeleton } from '../../components/ui/EntitySkeletons'
import { useTheme } from '../../components/providers/ThemeProvider'
import CustomAxios from '../../lib/axios/CustomAxios'
import { queryClient } from '../../lib/query/queryClient'
import token from '../../lib/token/token'
import {
    changeAccountPrivacy,
    getBlockedUsers,
    createInquiry,
    getMyInquiries,
    getMyProfile,
    getMyReportHistory,
    unBlockUser,
    type BlockedUserItem,
    type InquiryItem,
    type InquiryStatus,
    type MyReportHistoryItem,
    type ReportStatus,
    type UserProfileResponse,
} from '../../services/snapService'
import { queryKeys } from '../../services/queryKeys'

const subNav = ['계정', '알림', '개인정보 보호', '화면', '신고 내역', '고객센터']

const Row: React.FC<{
    label: string
    value?: string
    danger?: boolean
    chevron?: boolean
    loadingValue?: boolean
    onClick?: () => void
}> = ({ label, value, danger, chevron = true, loadingValue = false, onClick }) => (
    <button
        onClick={onClick}
        className="w-full h-14 px-5 flex items-center justify-between hover:bg-surface transition-colors"
    >
        <span className={`text-body-sm ${danger ? 'text-danger font-medium' : 'text-ink'}`}>
            {label}
        </span>
        <span className="flex items-center gap-2 text-sm text-muted">
            {loadingValue ? (
                <span
                    className="h-4 w-20 animate-pulse rounded bg-placeholder"
                    role="status"
                    aria-label={`${label} 값을 불러오는 중`}
                    aria-busy="true"
                />
            ) : (
                value
            )}
            {chevron && !loadingValue && <ChevronRightIcon size={18} className="text-muted" />}
        </span>
    </button>
)

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="mb-6">
        <h2 className="text-sm font-bold text-sub mb-2">{title}</h2>
        <div className="bg-panel border border-line rounded-2xl divide-y divide-line overflow-hidden">
            {children}
        </div>
    </div>
)

const SettingPage: React.FC = () => {
    const REPORT_SIZE_PER_TYPE = 10
    const INQUIRY_PAGE_SIZE = 20
    const BLOCKED_USER_SIZE = 50
    const [active, setActive] = useState(subNav[0])
    const [selectedReport, setSelectedReport] = useState<MyReportHistoryItem | null>(null)
    const [isBlockedUsersModalOpen, setIsBlockedUsersModalOpen] = useState(false)
    const [unBlockingUserId, setUnBlockingUserId] = useState<string | null>(null)
    const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false)
    const [inquiryTitle, setInquiryTitle] = useState('')
    const [inquiryContent, setInquiryContent] = useState('')
    const [isInquirySubmitting, setIsInquirySubmitting] = useState(false)
    const [inquiryError, setInquiryError] = useState<string | null>(null)
    const [push, setPush] = useState(true)
    const [marketingPush, setMarketingPush] = useState(false)
    const [socialPush, setSocialPush] = useState(true)
    const [emailNotice, setEmailNotice] = useState(true)
    const [isPrivacySubmitting, setIsPrivacySubmitting] = useState(false)
    const [searchExposure, setSearchExposure] = useState(true)
    const [commentAllow, setCommentAllow] = useState(true)
    const [autoPlayVideo, setAutoPlayVideo] = useState(true)
    const [reduceMotion, setReduceMotion] = useState(false)
    const navigate = useNavigate()
    const { isDark: dark, setTheme } = useTheme()
    const profileQuery = useQuery<UserProfileResponse>({
        queryKey: queryKeys.myProfile,
        queryFn: getMyProfile,
    })
    const profile = profileQuery.data ?? null
    const reportHistoryQuery = useQuery<MyReportHistoryItem[]>({
        queryKey: queryKeys.myReportHistory(REPORT_SIZE_PER_TYPE),
        queryFn: () => getMyReportHistory(REPORT_SIZE_PER_TYPE),
        enabled: active === '신고 내역',
    })
    const inquiryQuery = useQuery<InquiryItem[]>({
        queryKey: queryKeys.myInquiries(INQUIRY_PAGE_SIZE),
        queryFn: () => getMyInquiries(0, INQUIRY_PAGE_SIZE),
        enabled: active === '고객센터',
    })
    const blockedUsersQuery = useQuery<BlockedUserItem[]>({
        queryKey: queryKeys.myBlockedUsers(BLOCKED_USER_SIZE),
        queryFn: () => getBlockedUsers(0, BLOCKED_USER_SIZE),
        enabled: active === '개인정보 보호' || isBlockedUsersModalOpen,
    })

    const formatReportStatus = (status: ReportStatus) => {
        if (status === 'COMPLETED') return '처리 완료'
        if (status === 'IN_REVIEW') return '검토 중'
        return '접수됨'
    }

    const formatReportType = (type: MyReportHistoryItem['reportType']) => {
        if (type === 'SNAP') return '게시물'
        if (type === 'COMMENT') return '댓글'
        return '유저'
    }

    const formatReportDate = (value: string) => {
        const date = new Date(value)
        if (Number.isNaN(date.getTime())) return '-'
        return date.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    const formatInquiryStatus = (status: InquiryStatus) => {
        if (status === 'ANSWERED') return '답변 완료'
        return '접수됨'
    }

    const handleDarkModeChange = (nextDark: boolean) => {
        setTheme(nextDark ? 'dark' : 'light')
    }

    useEffect(() => {
        if (!selectedReport && !isInquiryModalOpen && !isBlockedUsersModalOpen) return

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setSelectedReport(null)
                setIsInquiryModalOpen(false)
                setIsBlockedUsersModalOpen(false)
            }
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [isBlockedUsersModalOpen, isInquiryModalOpen, selectedReport])

    const handleLogout = async () => {
        try {
            await CustomAxios.post('auth/logout')
        } catch (error) {
            console.warn('[auth] 서버 로그아웃 요청 실패', error)
        } finally {
            queryClient.clear()
            token.clear()
            navigate('/login', { replace: true })
        }
    }

    const handleTogglePrivateAccount = async (next: boolean) => {
        const previousProfile = queryClient.getQueryData<UserProfileResponse>(queryKeys.myProfile)

        setIsPrivacySubmitting(true)
        queryClient.setQueryData<UserProfileResponse | undefined>(queryKeys.myProfile, (old) =>
            old ? { ...old, isPrivate: next } : old,
        )

        try {
            const updated = await changeAccountPrivacy(next)
            queryClient.setQueryData(queryKeys.myProfile, updated)
        } catch (error) {
            console.warn('[user] 비공개 계정 설정 변경 실패', error)
            queryClient.setQueryData(queryKeys.myProfile, previousProfile)
        } finally {
            setIsPrivacySubmitting(false)
        }
    }

    const handleOpenInquiryModal = () => {
        setInquiryError(null)
        setIsInquiryModalOpen(true)
    }

    const handleOpenBlockedUsersModal = () => {
        setIsBlockedUsersModalOpen(true)
    }

    const handleUnblockUser = async (blockedUser: BlockedUserItem) => {
        try {
            setUnBlockingUserId(blockedUser.userId)
            await unBlockUser(blockedUser.userId)
            await blockedUsersQuery.refetch()
        } finally {
            setUnBlockingUserId(null)
        }
    }

    const handleSubmitInquiry = async () => {
        const title = inquiryTitle.trim()
        const content = inquiryContent.trim()

        if (!title || !content) {
            setInquiryError('제목과 내용을 모두 입력해 주세요.')
            return
        }

        if (title.length > 120 || content.length > 2000) {
            setInquiryError('제목은 120자, 내용은 2000자 이내로 입력해 주세요.')
            return
        }

        try {
            setIsInquirySubmitting(true)
            setInquiryError(null)
            await createInquiry(title, content)
            setInquiryTitle('')
            setInquiryContent('')
            setIsInquiryModalOpen(false)
            await inquiryQuery.refetch()
        } catch {
            setInquiryError('문의 등록에 실패했습니다. 잠시 후 다시 시도해 주세요.')
        } finally {
            setIsInquirySubmitting(false)
        }
    }

    const renderActivePanel = () => {
        switch (active) {
            case '계정':
                return (
                    <>
                        <Section title="계정">
                            <Row
                                label="프로필 정보"
                                value={profile?.username ?? '사용자'}
                                loadingValue={profileQuery.isLoading}
                            />
                            <Row
                                label="이메일 변경"
                                value={profile?.email ?? '-'}
                                loadingValue={profileQuery.isLoading}
                            />
                            <Row label="비밀번호 변경" />
                        </Section>

                        <Section title="환경설정">
                            <div className="h-14 px-5 flex items-center justify-between">
                                <span className="text-body-sm text-ink">푸시 알림</span>
                                <Toggle ariaLabel="푸시 알림" checked={push} onChange={setPush} />
                            </div>
                            <div className="h-14 px-5 flex items-center justify-between">
                                <span className="text-body-sm text-ink">다크 모드</span>
                                <Toggle ariaLabel="다크 모드" checked={dark} onChange={handleDarkModeChange} />
                            </div>
                            <Row label="언어" value="한국어" />
                        </Section>

                        <Section title="기타">
                            <Row label="로그아웃" danger chevron={false} onClick={handleLogout} />
                            <Row label="회원 탈퇴" danger chevron={false} />
                        </Section>
                    </>
                )

            case '알림':
                return (
                    <>
                        <Section title="푸시 알림">
                            <div className="h-14 px-5 flex items-center justify-between">
                                <span className="text-body-sm text-ink">전체 알림</span>
                                <Toggle ariaLabel="전체 알림" checked={push} onChange={setPush} />
                            </div>
                            <div className="h-14 px-5 flex items-center justify-between">
                                <span className="text-body-sm text-ink">좋아요/댓글 알림</span>
                                <Toggle ariaLabel="좋아요 및 댓글 알림" checked={socialPush} onChange={setSocialPush} />
                            </div>
                            <div className="h-14 px-5 flex items-center justify-between">
                                <span className="text-body-sm text-ink">마케팅/이벤트 알림</span>
                                <Toggle ariaLabel="마케팅 및 이벤트 알림" checked={marketingPush} onChange={setMarketingPush} />
                            </div>
                        </Section>

                        <Section title="이메일 알림">
                            <div className="h-14 px-5 flex items-center justify-between">
                                <span className="text-body-sm text-ink">중요 공지 메일</span>
                                <Toggle ariaLabel="중요 공지 메일" checked={emailNotice} onChange={setEmailNotice} />
                            </div>
                            <Row label="알림 시간 설정" value="09:00 - 22:00" />
                        </Section>
                    </>
                )

            case '개인정보 보호':
                return (
                    <>
                        <Section title="공개 범위">
                            <div className="h-14 px-5 flex items-center justify-between">
                                <span className="text-body-sm text-ink">비공개 계정</span>
                                {profileQuery.isLoading ? (
                                    <span
                                        className="h-6 w-11 animate-pulse rounded-full bg-placeholder"
                                        role="status"
                                        aria-label="계정 공개 범위를 불러오는 중"
                                        aria-busy="true"
                                    />
                                ) : (
                                    <Toggle
                                        ariaLabel="비공개 계정"
                                        checked={profile?.isPrivate ?? false}
                                        onChange={handleTogglePrivateAccount}
                                        disabled={isPrivacySubmitting || !profile}
                                    />
                                )}
                            </div>
                            <div className="h-14 px-5 flex items-center justify-between">
                                <span className="text-body-sm text-ink">검색 노출 허용</span>
                                <Toggle ariaLabel="검색 노출 허용" checked={searchExposure} onChange={setSearchExposure} />
                            </div>
                            <div className="h-14 px-5 flex items-center justify-between">
                                <span className="text-body-sm text-ink">댓글 허용</span>
                                <Toggle ariaLabel="댓글 허용" checked={commentAllow} onChange={setCommentAllow} />
                            </div>
                        </Section>

                        <Section title="데이터 및 보안">
                            <Row
                                label="차단 사용자 관리"
                                value={`${(blockedUsersQuery.data ?? []).length}명`}
                                loadingValue={blockedUsersQuery.isLoading}
                                onClick={handleOpenBlockedUsersModal}
                            />
                            <Row label="활동 상태 표시" value="친구에게만" />
                            <Row label="개인정보 다운로드" />
                        </Section>
                    </>
                )

            case '화면':
                return (
                    <>
                        <Section title="표시 옵션">
                            <div className="h-14 px-5 flex items-center justify-between">
                                <span className="text-body-sm text-ink">다크 모드</span>
                                <Toggle ariaLabel="다크 모드" checked={dark} onChange={handleDarkModeChange} />
                            </div>
                            <div className="h-14 px-5 flex items-center justify-between">
                                <span className="text-body-sm text-ink">동작 줄이기</span>
                                <Toggle ariaLabel="동작 줄이기" checked={reduceMotion} onChange={setReduceMotion} />
                            </div>
                            <Row label="글자 크기" value="보통" />
                        </Section>

                        <Section title="재생 설정">
                            <div className="h-14 px-5 flex items-center justify-between">
                                <span className="text-body-sm text-ink">영상 자동 재생</span>
                                <Toggle ariaLabel="영상 자동 재생" checked={autoPlayVideo} onChange={setAutoPlayVideo} />
                            </div>
                            <Row label="이미지 품질" value="고화질" />
                        </Section>
                    </>
                )

            case '신고 내역':
                return (
                    <>
                        <Section title="최근 신고">
                            {reportHistoryQuery.isLoading ? (
                                <SettingsRowsSkeleton />
                            ) : reportHistoryQuery.isError ? (
                                <div className="px-5 py-4 text-sm text-danger">신고 내역을 불러오지 못했습니다.</div>
                            ) : (reportHistoryQuery.data ?? []).length === 0 ? (
                                <div className="px-5 py-4 text-sm text-sub">신고 내역이 없습니다.</div>
                            ) : (
                                (reportHistoryQuery.data ?? []).slice(0, 12).map((report) => (
                                    <Row
                                        key={`${report.reportType}-${report.id}`}
                                        label={`${formatReportType(report.reportType)} 신고 · ${report.explanation}`}
                                        value={formatReportStatus(report.reportStatus)}
                                        onClick={() => setSelectedReport(report)}
                                    />
                                ))
                            )}
                        </Section>

                        <Section title="관리">
                            <Row
                                label="총 신고 건수"
                                value={`${(reportHistoryQuery.data ?? []).length}건`}
                                chevron={false}
                                loadingValue={reportHistoryQuery.isLoading}
                            />
                            <Row label="신고 가이드" />
                        </Section>
                    </>
                )

            case '고객센터':
                return (
                    <>
                        <Section title="도움말">
                            <Row label="자주 묻는 질문" />
                            <Row label="문의하기" onClick={handleOpenInquiryModal} />
                            <Row label="공지사항" />
                        </Section>

                        <Section title="내 문의 내역">
                            {inquiryQuery.isLoading ? (
                                <SettingsTableSkeleton />
                            ) : inquiryQuery.isError ? (
                                <div className="px-5 py-4 text-sm text-danger">문의 내역을 불러오지 못했습니다.</div>
                            ) : (inquiryQuery.data ?? []).length === 0 ? (
                                <div className="px-5 py-4 text-sm text-sub">등록된 문의가 없습니다.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-surface text-sub text-left">
                                                <th className="px-4 py-3 font-semibold">내용</th>
                                                <th className="px-4 py-3 font-semibold w-[120px]">상태</th>
                                                <th className="px-4 py-3 font-semibold w-[180px]">등록일</th>
                                                <th className="px-4 py-3 font-semibold">답변</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(inquiryQuery.data ?? []).map((inquiry) => (
                                                <tr key={inquiry.id} className="border-t border-line align-top">
                                                    <td className="px-4 py-3 text-ink">
                                                        <p className="text-sub whitespace-pre-wrap break-words">{inquiry.content}</p>
                                                    </td>
                                                    <td className="px-4 py-3 text-ink">{formatInquiryStatus(inquiry.status)}</td>
                                                    <td className="px-4 py-3 text-sub">{formatReportDate(inquiry.createdAt)}</td>
                                                    <td className="px-4 py-3 text-sub whitespace-pre-wrap break-words">
                                                        {inquiry.responseMessage?.trim() || '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Section>

                        <Section title="정책">
                            <Row label="이용약관" />
                            <Row label="개인정보 처리방침" />
                            <Row label="오픈소스 라이선스" />
                        </Section>
                    </>
                )

            default:
                return null
        }
    }

    return (
        <>
            <div className="px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
                <h1 className="text-2xl font-bold text-ink mb-6">설정</h1>

                <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
                    <aside className="w-full lg:w-56 lg:shrink-0">
                        <div className="flex gap-2 overflow-x-auto pb-1 lg:block lg:overflow-visible lg:rounded-2xl lg:border lg:border-line lg:bg-panel lg:p-2">
                            {subNav.map((item) => {
                                const isActive = item === active
                                return (
                                    <button
                                        key={item}
                                        onClick={() => setActive(item)}
                                        className={`relative flex min-h-12 w-auto shrink-0 items-center justify-center rounded-xl border px-5 text-base transition-colors lg:min-h-11 lg:w-full lg:justify-start lg:border-transparent lg:px-4 lg:text-body-sm ${
                                            isActive
                                                ? 'border-brand bg-brand-soft text-ink font-bold lg:bg-surface'
                                                : 'border-line bg-panel text-sub hover:bg-surface/70'
                                        }`}
                                    >
                                        {isActive && (
                                            <span className="absolute bottom-1.5 left-0 top-1.5 hidden w-1 rounded-sm bg-brand lg:block" />
                                        )}
                                        {item}
                                    </button>
                                )
                            })}
                        </div>
                    </aside>

                    <div className="min-w-0 flex-1 max-w-[760px]">
                        {renderActivePanel()}
                    </div>
                </div>
            </div>

            {selectedReport && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4"
                    onClick={() => setSelectedReport(null)}
                >
                    <div
                        className="w-full max-w-xl rounded-2xl border border-line bg-panel p-6 shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3 mb-4">
                            <h3 className="text-lg font-bold text-ink">신고 상세 정보</h3>
                            <button
                                type="button"
                                className="rounded-md border border-line px-3 py-1.5 text-sm text-sub hover:bg-surface"
                                onClick={() => setSelectedReport(null)}
                            >
                                닫기
                            </button>
                        </div>

                        <div className="space-y-3 text-sm">
                            <div className="grid grid-cols-[96px_1fr] gap-2">
                                <span className="text-sub">유형</span>
                                <span className="text-ink font-medium">{formatReportType(selectedReport.reportType)}</span>
                            </div>
                            <div className="grid grid-cols-[96px_1fr] gap-2">
                                <span className="text-sub">상태</span>
                                <span className="text-ink font-medium">{formatReportStatus(selectedReport.reportStatus)}</span>
                            </div>
                            <div className="grid grid-cols-[96px_1fr] gap-2">
                                <span className="text-sub">대상</span>
                                <span className="text-ink font-medium">{selectedReport.targetLabel}</span>
                            </div>
                            <div className="grid grid-cols-[96px_1fr] gap-2">
                                <span className="text-sub">접수일</span>
                                <span className="text-ink">{formatReportDate(selectedReport.createdAt)}</span>
                            </div>

                            <div className="pt-2">
                                <p className="text-sub mb-1.5">신고 내용</p>
                                <div className="rounded-xl border border-line bg-surface px-4 py-3 text-ink whitespace-pre-wrap break-words">
                                    {selectedReport.explanation}
                                </div>
                            </div>

                            {selectedReport.responseMessage?.trim() && (
                                <div className="pt-1">
                                    <p className="text-sub mb-1.5">관리자 답변</p>
                                    <div className="rounded-xl border border-brand/35 bg-brand/10 px-4 py-3 text-ink whitespace-pre-wrap break-words">
                                        {selectedReport.responseMessage}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {isInquiryModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4"
                    onClick={() => setIsInquiryModalOpen(false)}
                >
                    <div
                        className="w-full max-w-xl rounded-2xl border border-line bg-panel p-6 shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3 mb-4">
                            <h3 className="text-lg font-bold text-ink">문의하기</h3>
                            <button
                                type="button"
                                className="rounded-md border border-line px-3 py-1.5 text-sm text-sub hover:bg-surface"
                                onClick={() => setIsInquiryModalOpen(false)}
                            >
                                닫기
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label htmlFor="inquiry-title" className="block text-sm text-sub mb-1.5">
                                    제목
                                </label>
                                <input
                                    id="inquiry-title"
                                    type="text"
                                    maxLength={120}
                                    value={inquiryTitle}
                                    onChange={(event) => setInquiryTitle(event.target.value)}
                                    className="w-full rounded-xl border border-line bg-panel px-4 py-2.5 text-ink outline-none focus:ring-2 focus:ring-brand/30"
                                    placeholder="문의 제목을 입력해 주세요"
                                />
                            </div>

                            <div>
                                <label htmlFor="inquiry-content" className="block text-sm text-sub mb-1.5">
                                    내용
                                </label>
                                <textarea
                                    id="inquiry-content"
                                    maxLength={2000}
                                    rows={7}
                                    value={inquiryContent}
                                    onChange={(event) => setInquiryContent(event.target.value)}
                                    className="w-full rounded-xl border border-line bg-panel px-4 py-3 text-ink outline-none focus:ring-2 focus:ring-brand/30 resize-none"
                                    placeholder="문의 내용을 입력해 주세요"
                                />
                            </div>

                            {inquiryError && <p className="text-sm text-danger">{inquiryError}</p>}

                            <div className="flex justify-end gap-2 pt-1">
                                <button
                                    type="button"
                                    className="rounded-lg border border-line px-4 py-2 text-sm text-sub hover:bg-surface"
                                    onClick={() => setIsInquiryModalOpen(false)}
                                >
                                    취소
                                </button>
                                <button
                                    type="button"
                                    className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-on-brand disabled:opacity-60"
                                    onClick={handleSubmitInquiry}
                                    disabled={isInquirySubmitting}
                                >
                                    {isInquirySubmitting ? '등록 중...' : '문의 등록'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isBlockedUsersModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4"
                    onClick={() => setIsBlockedUsersModalOpen(false)}
                >
                    <div
                        className="w-full max-w-xl rounded-2xl border border-line bg-panel p-6 shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3 mb-4">
                            <h3 className="text-lg font-bold text-ink">차단 사용자 관리</h3>
                            <button
                                type="button"
                                className="rounded-md border border-line px-3 py-1.5 text-sm text-sub hover:bg-surface"
                                onClick={() => setIsBlockedUsersModalOpen(false)}
                            >
                                닫기
                            </button>
                        </div>

                        <div className="max-h-[420px] overflow-y-auto rounded-xl border border-line divide-y divide-line">
                            {blockedUsersQuery.isLoading ? (
                                <SettingsRowsSkeleton />
                            ) : blockedUsersQuery.isError ? (
                                <div className="px-4 py-3 text-sm text-danger">차단 사용자 목록을 불러오지 못했습니다.</div>
                            ) : (blockedUsersQuery.data ?? []).length === 0 ? (
                                <div className="px-4 py-3 text-sm text-sub">차단한 사용자가 없습니다.</div>
                            ) : (
                                (blockedUsersQuery.data ?? []).map((blockedUser) => (
                                    <div key={blockedUser.userId} className="flex items-center justify-between gap-3 px-4 py-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-ink truncate">{blockedUser.username}</p>
                                        </div>
                                        <button
                                            type="button"
                                            className="rounded-lg border border-line px-3 py-1.5 text-sm text-sub hover:bg-surface disabled:opacity-60"
                                            onClick={() => void handleUnblockUser(blockedUser)}
                                            disabled={unBlockingUserId === blockedUser.userId}
                                        >
                                            {unBlockingUserId === blockedUser.userId ? '처리 중...' : '차단 취소'}
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

export default SettingPage
