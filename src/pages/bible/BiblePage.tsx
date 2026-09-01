import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
    FiAlertCircle,
    FiBookOpen,
    FiCheck,
    FiChevronRight,
    FiEdit3,
    FiLock,
    FiRefreshCw,
    FiSearch,
} from 'react-icons/fi'
import {
    getBibleLicenseStatus,
    getPrivateBibleMeditation,
    savePrivateBibleMeditation,
    searchBibleVerses,
} from '../../services/bible/bibleService'
import type {
    BibleLicenseStatus,
    BibleVerseSummary,
    PrivateBibleMeditation,
} from '../../services/bible/bibleTypes'
import type { BibleLayoutOutletContext } from './BibleLayout'

const MAX_MEDITATION_LENGTH = 5000

const SAFE_PENDING_LICENSE_STATUS: BibleLicenseStatus = {
    phase: 'pending',
    searchAvailable: false,
    textDisplayAllowed: false,
    notice: '성경 본문 이용 허가 절차를 진행 중입니다.',
}

function formatDatetimeInputValue(value: string | null | undefined): string {
    if (!value?.trim()) return getCurrentDatetimeInputValue()
    const base = value.trim().replace(' ', 'T')
    return base.includes('.')
        ? base.split('.')[0].slice(0, 16)
        : base.slice(0, 16)
}

function getCurrentDatetimeInputValue(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hour}:${minute}`
}

function formatVerseReference(verse: BibleVerseSummary): string {
    if (verse.reference?.trim()) return verse.reference.trim()
    return `${verse.bookName} ${verse.chapter}:${verse.verse}`
}

function LicensePanel({
    status,
    loading,
    error,
    onRetry,
}: {
    status: BibleLicenseStatus
    loading: boolean
    error: string
    onRetry: () => void
}) {
    const isActive = status.phase === 'active' && status.searchAvailable && status.textDisplayAllowed

    return (
        <section
            className={`bible-license ${isActive ? 'bible-license--active' : ''}`}
            aria-labelledby="bible-license-title"
        >
            <span className="bible-license__icon" aria-hidden="true">
                {isActive ? <FiCheck size={20} /> : <FiLock size={20} />}
            </span>
            <div className="bible-license__copy">
                <p className="bible-eyebrow">본문 이용 상태</p>
                <h2 id="bible-license-title">
                    {isActive ? '허가된 본문 검색이 열려 있습니다' : '라이선스 확인 전에는 본문을 표시하지 않습니다'}
                </h2>
                <p>
                    {status.notice ||
                        (isActive
                            ? '허가 범위 안에서 검색 결과를 제공합니다.'
                            : '허가가 완료되면 검색과 구절 선택 기능이 자동으로 활성화됩니다.')}
                </p>
                {status.providerName ? <p className="bible-license__meta">제공처: {status.providerName}</p> : null}
                {error ? <p className="bible-inline-error" role="alert">{error}</p> : null}
            </div>
            <button
                className="bible-button bible-button--quiet"
                type="button"
                onClick={onRetry}
                disabled={loading}
            >
                <FiRefreshCw className={loading ? 'bible-spin' : ''} size={17} aria-hidden="true" />
                {loading ? '확인 중…' : '상태 다시 확인'}
            </button>
        </section>
    )
}

function SearchLoadingState() {
    return (
        <div className="bible-state" role="status" aria-live="polite">
            <FiRefreshCw className="bible-spin" size={24} aria-hidden="true" />
            <strong>허가된 본문을 검색하고 있습니다</strong>
            <p>검색 결과를 안전하게 불러오는 중입니다.</p>
        </div>
    )
}

const BiblePage = () => {
    const { setHasUnsavedChanges } = useOutletContext<BibleLayoutOutletContext>()
    const [licenseStatus, setLicenseStatus] = useState<BibleLicenseStatus>(SAFE_PENDING_LICENSE_STATUS)
    const [licenseLoading, setLicenseLoading] = useState(true)
    const [licenseError, setLicenseError] = useState('')
    const [query, setQuery] = useState('')
    const [activeQuery, setActiveQuery] = useState('')
    const [results, setResults] = useState<BibleVerseSummary[]>([])
    const [searchLoading, setSearchLoading] = useState(false)
    const [searchLoadingMore, setSearchLoadingMore] = useState(false)
    const [searchPage, setSearchPage] = useState(0)
    const [searchHasNext, setSearchHasNext] = useState(false)
    const [searchError, setSearchError] = useState('')
    const [hasSearched, setHasSearched] = useState(false)
    const [selectedVerse, setSelectedVerse] = useState<BibleVerseSummary | null>(null)
    const [selectionNotice, setSelectionNotice] = useState('')
    const [meditation, setMeditation] = useState<PrivateBibleMeditation | null>(null)
    const [draft, setDraft] = useState('')
    const [savedContent, setSavedContent] = useState('')
    const [worshipAt, setWorshipAt] = useState('')
    const [savedWorshipAt, setSavedWorshipAt] = useState('')
    const [meditationLoading, setMeditationLoading] = useState(false)
    const [meditationSaving, setMeditationSaving] = useState(false)
    const [meditationError, setMeditationError] = useState('')
    const [meditationConflict, setMeditationConflict] = useState(false)
    const [meditationReloadNonce, setMeditationReloadNonce] = useState(0)
    const [saveMessage, setSaveMessage] = useState('')

    const canSearch =
        licenseStatus.phase === 'active' &&
        licenseStatus.searchAvailable &&
        licenseStatus.textDisplayAllowed
    const isDirty = draft !== savedContent || worshipAt !== savedWorshipAt

    useEffect(() => {
        setHasUnsavedChanges(isDirty)
        return () => setHasUnsavedChanges(false)
    }, [isDirty, setHasUnsavedChanges])

    const loadLicense = useCallback(async () => {
        setLicenseLoading(true)
        setLicenseError('')

        try {
            const status = await getBibleLicenseStatus()
            setLicenseStatus(status)
            const active = status.phase === 'active' && status.searchAvailable && status.textDisplayAllowed
            if (!active) {
                setResults([])
                setSelectedVerse((current) => current ? {
                    ...current,
                    text: undefined,
                    displayAllowed: false,
                } : null)
                setHasSearched(false)
                setSearchHasNext(false)
            }
        } catch {
            setLicenseStatus(SAFE_PENDING_LICENSE_STATUS)
            setResults([])
            setSelectedVerse((current) => current ? {
                ...current,
                text: undefined,
                displayAllowed: false,
            } : null)
            setHasSearched(false)
            setSearchHasNext(false)
            setLicenseError('상태 확인 서버에 연결하지 못해 검색을 안전하게 잠갔습니다.')
        } finally {
            setLicenseLoading(false)
        }
    }, [])

    useEffect(() => {
        void loadLicense()
    }, [loadLicense])

    const selectedVerseId = selectedVerse?.id
    useEffect(() => {
        if (!selectedVerse || !selectedVerseId) {
            const initialWorshipTime = getCurrentDatetimeInputValue()
            setMeditation(null)
            setDraft('')
            setSavedContent('')
            setWorshipAt(initialWorshipTime)
            setSavedWorshipAt(initialWorshipTime)
            return
        }

        const controller = new AbortController()
        setMeditationLoading(true)
        setMeditationError('')
        setMeditationConflict(false)
        setSaveMessage('')

        void getPrivateBibleMeditation(selectedVerse, controller.signal)
            .then((savedMeditation) => {
                if (controller.signal.aborted) return
                const content = savedMeditation?.content ?? ''
                const worshipTime = formatDatetimeInputValue(savedMeditation?.worshipAt)
                setMeditation(savedMeditation)
                setDraft(content)
                setSavedContent(content)
                setWorshipAt(worshipTime)
                setSavedWorshipAt(worshipTime)
            })
            .catch(() => {
                if (controller.signal.aborted) return
                const initialWorshipTime = getCurrentDatetimeInputValue()
                setMeditation(null)
                setDraft('')
                setSavedContent('')
                setWorshipAt(initialWorshipTime)
                setSavedWorshipAt(initialWorshipTime)
                setMeditationError('저장된 묵상을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
            })
            .finally(() => {
                if (!controller.signal.aborted) setMeditationLoading(false)
            })

        return () => controller.abort()
    }, [selectedVerseId, meditationReloadNonce])

    const performSearch = async ({
        queryValue,
        page,
        append,
    }: {
        queryValue: string
        page: number
        append: boolean
    }) => {
        const normalizedQuery = queryValue.trim()
        if (!canSearch || !normalizedQuery || searchLoading || searchLoadingMore) return

        if (append) setSearchLoadingMore(true)
        else setSearchLoading(true)
        setSearchError('')
        setSelectionNotice('')
        setHasSearched(true)
        if (!append) setActiveQuery(normalizedQuery)

        try {
            const response = await searchBibleVerses({ query: normalizedQuery, page, size: 30 })
            setResults((current) => append ? [...current, ...response.items] : response.items)
            setSearchPage(response.page)
            setSearchHasNext(response.hasNext)
        } catch {
            if (!append) setResults([])
            setSearchError('검색 결과를 불러오지 못했습니다. 검색어를 확인하고 다시 시도해주세요.')
        } finally {
            if (append) setSearchLoadingMore(false)
            else setSearchLoading(false)
        }
    }

    const handleSearch = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        void performSearch({ queryValue: query, page: 0, append: false })
    }

    const handleSelectVerse = (verse: BibleVerseSummary) => {
        if (selectedVerse?.id !== verse.id && isDirty) {
            setSelectionNotice('저장하지 않은 묵상이 있습니다. 먼저 저장하거나 변경을 취소해주세요.')
            return
        }

        setSelectionNotice('')
        setMeditationConflict(false)
        setSelectedVerse(verse)
        requestAnimationFrame(() => {
            document.getElementById('bible-meditation-editor')?.scrollIntoView({ block: 'start' })
        })
    }

    const handleSaveMeditation = async () => {
        if (!selectedVerse || meditationSaving || !isDirty) return
        if (!draft.trim()) {
            setMeditationError('묵상 내용을 한 글자 이상 입력해주세요.')
            return
        }
        if (!worshipAt.trim()) {
            setMeditationError('예배 시간을 입력해주세요.')
            return
        }

        setMeditationSaving(true)
        setMeditationError('')
        setSaveMessage('')
        const submittedContent = draft
        const submittedWorshipAt = worshipAt.trim()

        try {
            const saved = await savePrivateBibleMeditation(selectedVerse, {
                content: submittedContent,
                worshipAt: submittedWorshipAt,
            }, meditation || undefined)
            setMeditation(saved)
            setMeditationConflict(false)
            setDraft((current) => current === submittedContent ? saved.content : current)
            setSavedContent(saved.content)
            const worshipTime = formatDatetimeInputValue(saved.worshipAt)
            setWorshipAt(worshipTime)
            setSavedWorshipAt(worshipTime)
            setSaveMessage('말씀 노트를 비공개로 저장했습니다.')
        } catch (error) {
            const conflict = Boolean(
                error &&
                typeof error === 'object' &&
                'response' in error &&
                (error as { response?: { status?: number } }).response?.status === 409,
            )
            setMeditationConflict(conflict)
            setMeditationError(conflict
                ? '다른 창에서 묵상이 변경되었습니다. 현재 내용을 확인한 뒤 최신 묵상을 불러와 다시 저장해주세요.'
                : '묵상을 저장하지 못했습니다. 작성 내용은 화면에 남아 있습니다.')
        } finally {
            setMeditationSaving(false)
        }
    }

    const liveMessage = useMemo(() => {
        if (searchLoading || searchLoadingMore) return '성경 구절 검색 중'
        if (searchError) return searchError
        if (hasSearched) return results.length > 0 ? `${results.length}개의 구절을 찾았습니다.` : '검색 결과가 없습니다.'
        return canSearch ? '성경 본문 검색 준비 완료' : '라이선스 확인 대기 중'
    }, [canSearch, hasSearched, results.length, searchError, searchLoading, searchLoadingMore])

    return (
        <div className="bible-page">
            <p className="bible-sr-only" role="status" aria-live="polite" aria-atomic="true">
                {liveMessage}
            </p>

            <section className="bible-intro" aria-labelledby="bible-page-title">
                <div>
                    <p className="bible-eyebrow">READ · NOTICE · WRITE</p>
                    <h1 id="bible-page-title">한 구절을 찾고, 조용히 기록하세요</h1>
                    <p>
                        허가된 성경 본문만 검색하며, 작성한 묵상은 내 계정에 비공개로 저장됩니다.
                    </p>
                </div>
                <span className="bible-intro__seal" aria-hidden="true">PRIVATE</span>
            </section>

            <LicensePanel
                status={licenseStatus}
                loading={licenseLoading}
                error={licenseError}
                onRetry={() => void loadLicense()}
            />

            <div className="bible-workspace">
                <section className="bible-search-pane" aria-labelledby="bible-search-title">
                    <div className="bible-section-heading">
                        <span className="bible-section-heading__number" aria-hidden="true">01</span>
                        <div>
                            <p className="bible-eyebrow">성경 검색</p>
                            <h2 id="bible-search-title">구절을 찾아 선택하세요</h2>
                        </div>
                    </div>

                    <form className="bible-search-form" onSubmit={handleSearch}>
                        <label htmlFor="bible-search-input">책 이름, 장·절 또는 검색어</label>
                        <div className="bible-search-form__row">
                            <span className="bible-search-form__icon" aria-hidden="true">
                                <FiSearch size={20} />
                            </span>
                            <input
                                id="bible-search-input"
                                name="bible-search"
                                type="search"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder={canSearch ? '예: 책 이름 3:16 또는 검색어' : '라이선스 확인 후 검색할 수 있습니다'}
                                autoComplete="off"
                                disabled={!canSearch || searchLoading || searchLoadingMore}
                                aria-describedby="bible-search-help"
                            />
                            <button
                                className="bible-button bible-button--primary"
                                type="submit"
                                disabled={!canSearch || !query.trim() || searchLoading || searchLoadingMore}
                            >
                                {searchLoading ? <FiRefreshCw className="bible-spin" size={18} aria-hidden="true" /> : <FiSearch size={18} aria-hidden="true" />}
                                {searchLoading ? '검색 중…' : '검색'}
                            </button>
                        </div>
                        <p id="bible-search-help">
                            본문 이용 권한이 확인된 경우에만 검색 결과와 구절 내용을 표시합니다.
                        </p>
                    </form>

                    <div className="bible-results" aria-busy={searchLoading || searchLoadingMore}>
                        {searchLoading ? <SearchLoadingState /> : null}

                        {!searchLoading && searchError ? (
                            <div className="bible-state bible-state--error" role="alert">
                                <FiAlertCircle size={24} aria-hidden="true" />
                                <strong>검색을 완료하지 못했습니다</strong>
                                <p>{searchError}</p>
                                <button
                                    className="bible-button bible-button--quiet"
                                    type="button"
                                    onClick={() => void performSearch({
                                        queryValue: activeQuery || query,
                                        page: searchError && results.length > 0 ? searchPage + 1 : 0,
                                        append: results.length > 0,
                                    })}
                                >
                                    <FiRefreshCw size={17} aria-hidden="true" />
                                    다시 검색
                                </button>
                            </div>
                        ) : null}

                        {!searchLoading && !searchError && !hasSearched ? (
                            <div className="bible-state">
                                <FiBookOpen size={28} aria-hidden="true" />
                                <strong>{canSearch ? '검색어를 입력해 시작하세요' : '본문 이용 허가를 기다리고 있습니다'}</strong>
                                <p>
                                    {canSearch
                                        ? '결과에서 한 구절을 선택하면 오른쪽 묵상 노트가 열립니다.'
                                        : '허가 전에는 어떤 성경 본문도 앱에 하드코딩하거나 표시하지 않습니다.'}
                                </p>
                            </div>
                        ) : null}

                        {!searchLoading && !searchError && hasSearched && results.length === 0 ? (
                            <div className="bible-state">
                                <FiSearch size={26} aria-hidden="true" />
                                <strong>일치하는 구절이 없습니다</strong>
                                <p>책 이름, 장·절 또는 검색어를 바꿔 다시 검색해보세요.</p>
                            </div>
                        ) : null}

                        {!searchLoading && !searchError && results.length > 0 ? (
                            <>
                                <div className="bible-results__summary">
                                    <strong>{results.length}개 구절</strong>
                                    <span>하나를 선택해 비공개 묵상을 작성하세요</span>
                                </div>
                                {selectionNotice ? <p className="bible-inline-error" role="alert">{selectionNotice}</p> : null}
                                <ol className="bible-result-list">
                                    {results.map((verse) => {
                                        const selected = selectedVerse?.id === verse.id
                                        const canDisplayVerse =
                                            licenseStatus.textDisplayAllowed &&
                                            verse.displayAllowed &&
                                            Boolean(verse.text?.trim())

                                        return (
                                            <li key={verse.id}>
                                                <button
                                                    className={`bible-result ${selected ? 'bible-result--selected' : ''}`}
                                                    type="button"
                                                    onClick={() => handleSelectVerse(verse)}
                                                    aria-pressed={selected}
                                                >
                                                    <span className="bible-result__reference">
                                                        {formatVerseReference(verse)}
                                                    </span>
                                                    <span className="bible-result__translation">
                                                        {verse.translation || '허가된 번역본'}
                                                    </span>
                                                    <span className="bible-result__text">
                                                        {canDisplayVerse
                                                            ? verse.text
                                                            : '본문 표시 권한이 확인되지 않아 참조 정보만 제공합니다.'}
                                                    </span>
                                                    <span className="bible-result__action">
                                                        묵상하기
                                                        <FiChevronRight size={18} aria-hidden="true" />
                                                    </span>
                                                </button>
                                            </li>
                                        )
                                    })}
                                </ol>
                                {searchHasNext ? (
                                    <div className="bible-results__more">
                                        <button
                                            className="bible-button bible-button--quiet"
                                            type="button"
                                            onClick={() => void performSearch({
                                                queryValue: activeQuery,
                                                page: searchPage + 1,
                                                append: true,
                                            })}
                                            disabled={searchLoadingMore}
                                        >
                                            {searchLoadingMore ? (
                                                <FiRefreshCw className="bible-spin" size={17} aria-hidden="true" />
                                            ) : null}
                                            {searchLoadingMore ? '다음 구절 불러오는 중…' : '검색 결과 더 보기'}
                                        </button>
                                    </div>
                                ) : null}
                            </>
                        ) : null}
                    </div>
                </section>

                <section
                    id="bible-meditation-editor"
                    className="bible-editor-pane"
                    aria-labelledby="bible-editor-title"
                >
                    <div className="bible-section-heading">
                        <span className="bible-section-heading__number" aria-hidden="true">02</span>
                        <div>
                            <p className="bible-eyebrow">말씀 노트 · 비공개</p>
                            <h2 id="bible-editor-title">예배 시간과 마음에 남은 내용을 기록하세요</h2>
                        </div>
                    </div>

                    {!selectedVerse ? (
                        <div className="bible-state bible-state--editor">
                            <FiEdit3 size={28} aria-hidden="true" />
                            <strong>선택한 구절이 없습니다</strong>
                            <p>검색 결과에서 구절을 선택하면 이곳에 개인 묵상 노트가 열립니다.</p>
                        </div>
                    ) : (
                        <div className="bible-editor">
                            <div className="bible-selected-verse">
                                <div>
                                    <p className="bible-eyebrow">선택한 구절</p>
                                    <h3>{formatVerseReference(selectedVerse)}</h3>
                                </div>
                                <span>{selectedVerse.translation || '허가된 번역본'}</span>
                                {licenseStatus.textDisplayAllowed && selectedVerse.displayAllowed && selectedVerse.text?.trim() ? (
                                    <blockquote>{selectedVerse.text}</blockquote>
                                ) : (
                                    <p className="bible-selected-verse__protected">
                                        본문 표시 권한이 확인되지 않아 구절 내용은 숨겨져 있습니다.
                                    </p>
                                )}
                            </div>

                            {meditationLoading ? (
                                <div className="bible-state" role="status" aria-live="polite">
                                    <FiRefreshCw className="bible-spin" size={22} aria-hidden="true" />
                                    <strong>저장된 묵상을 불러오는 중입니다</strong>
                                </div>
                            ) : (
                                <>
                                    <div className="bible-privacy-note" id="bible-privacy-note">
                                        <FiLock size={17} aria-hidden="true" />
                                        <span>이 말씀 노트는 내 계정에서만 볼 수 있는 비공개 기록입니다.</span>
                                    </div>

                                    <div className="bible-editor__field">
                                        <label className="bible-editor__label" htmlFor="bible-worship-at">
                                            예배 시간
                                        </label>
                                        <input
                                            id="bible-worship-at"
                                            type="datetime-local"
                                            value={worshipAt}
                                            onChange={(event) => {
                                                setWorshipAt(event.target.value)
                                                setMeditationError('')
                                                setSaveMessage('')
                                            }}
                                        />
                                    </div>

                                    <label className="bible-editor__label" htmlFor="bible-meditation-textarea">
                                        말씀 노트 내용
                                    </label>
                                    <textarea
                                        id="bible-meditation-textarea"
                                        value={draft}
                                        onChange={(event) => {
                                            setDraft(event.target.value)
                                            setMeditationError('')
                                            setSaveMessage('')
                                        }}
                                        maxLength={MAX_MEDITATION_LENGTH}
                                        placeholder="이 구절에서 발견한 점, 감사, 질문, 오늘의 실천을 자유롭게 적어보세요."
                                        aria-describedby="bible-privacy-note bible-meditation-count"
                                    />

                                    <div className="bible-editor__meta">
                                        <span id="bible-meditation-count">
                                            {draft.length.toLocaleString()} / {MAX_MEDITATION_LENGTH.toLocaleString()}자
                                        </span>
                                        <span className={isDirty ? 'bible-unsaved' : ''}>
                                            {isDirty ? '저장하지 않은 변경 사항' : '저장된 상태'}
                                        </span>
                                    </div>

                                    {meditationError ? <p className="bible-inline-error" role="alert">{meditationError}</p> : null}
                                    {meditationConflict ? (
                                        <button
                                            className="bible-button bible-button--quiet"
                                            type="button"
                                            onClick={() => {
                                                if (isDirty && !window.confirm('최신 묵상을 불러오면 현재 작성 내용이 바뀝니다. 계속할까요?')) return
                                                setMeditationError('')
                                                setMeditationConflict(false)
                                                setMeditationReloadNonce((value) => value + 1)
                                            }}
                                        >
                                            <FiRefreshCw size={17} aria-hidden="true" />
                                            최신 묵상 불러오기
                                        </button>
                                    ) : null}
                                    <p className="bible-save-message" role="status" aria-live="polite">
                                        {saveMessage}
                                    </p>

                                    <div className="bible-editor__actions">
                                        <button
                                            className="bible-button bible-button--quiet"
                                            type="button"
                                            onClick={() => {
                                                setDraft(savedContent)
                                                setWorshipAt(savedWorshipAt)
                                                setMeditationError('')
                                                setSaveMessage('변경 사항을 취소했습니다.')
                                            }}
                                            disabled={!isDirty || meditationSaving}
                                        >
                                            변경 취소
                                        </button>
                                        <button
                                            className="bible-button bible-button--primary"
                                            type="button"
                                            onClick={() => void handleSaveMeditation()}
                                            disabled={!isDirty || meditationSaving || !draft.trim() || !worshipAt.trim()}
                                        >
                                            {meditationSaving ? <FiRefreshCw className="bible-spin" size={18} aria-hidden="true" /> : <FiLock size={17} aria-hidden="true" />}
                                            {meditationSaving ? '저장 중…' : '비공개로 저장'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </section>
            </div>
        </div>
    )
}

export default BiblePage
