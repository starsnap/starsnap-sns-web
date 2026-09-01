import axios from 'axios'
import AuthAxios from '../../lib/axios/AuthAxios'
import type {
    BibleLicenseStatus,
    BibleMeditationApiDto,
    BibleSearchRequest,
    BibleSearchResponse,
    BibleSlice,
    BibleVerseApiDto,
    BibleVerseSummary,
    PrivateBibleMeditation,
    SavePrivateBibleMeditationRequest,
} from './bibleTypes'

const DEFAULT_TRANSLATION_CODE = 'NKRV'

function verseId(verse: Pick<BibleVerseApiDto, 'translationCode' | 'bookCode' | 'chapter' | 'verse'>) {
    return `${verse.translationCode}:${verse.bookCode}:${verse.chapter}:${verse.verse}`
}

function toVerseSummary(verse: BibleVerseApiDto): BibleVerseSummary {
    return {
        id: verseId(verse),
        bookCode: verse.bookCode,
        bookName: verse.bookName,
        chapter: verse.chapter,
        verse: verse.verse,
        translation: verse.translationName,
        text: verse.text,
        displayAllowed: true,
    }
}

function toPrivateMeditation(
    meditation: BibleMeditationApiDto,
    selectedVerse: BibleVerseSummary,
): PrivateBibleMeditation {
    return {
        id: meditation.id,
        verseId: selectedVerse.id,
        endVerse: meditation.endVerse ?? meditation.verse,
        content: meditation.content,
        worshipAt: meditation.worshipAt ?? null,
        visibility: 'private',
        version: meditation.version,
        createdAt: meditation.createdAt,
        updatedAt: meditation.modifiedAt,
    }
}

export async function getBibleLicenseStatus(signal?: AbortSignal): Promise<BibleLicenseStatus> {
    const response = await AuthAxios.get<BibleLicenseStatus>('bible/license/status', {
        signal,
        params: { translationCode: DEFAULT_TRANSLATION_CODE },
    })
    return response.data
}

export async function searchBibleVerses(
    request: BibleSearchRequest,
    signal?: AbortSignal,
): Promise<BibleSearchResponse> {
    const response = await AuthAxios.get<BibleSlice<BibleVerseApiDto>>('bible/verses', {
        signal,
        params: {
            translationCode: DEFAULT_TRANSLATION_CODE,
            query: request.query,
            page: request.page ?? 0,
            size: request.size ?? 30,
        },
    })
    return {
        items: response.data.content.map(toVerseSummary),
        page: response.data.number,
        size: response.data.size,
        hasNext: !response.data.last,
    }
}

export async function getBibleVerseRange(
    verse: BibleVerseSummary,
    endVerse: number,
    signal?: AbortSignal,
): Promise<BibleVerseSummary[]> {
    const response = await AuthAxios.get<BibleVerseApiDto[]>('bible/verses/range', {
        signal,
        params: {
            translationCode: DEFAULT_TRANSLATION_CODE,
            bookCode: verse.bookCode,
            chapter: verse.chapter,
            verse: verse.verse,
            endVerse,
        },
    })
    return response.data.map(toVerseSummary)
}

export async function getPrivateBibleMeditation(
    verse: BibleVerseSummary,
    signal?: AbortSignal,
): Promise<PrivateBibleMeditation | null> {
    try {
        const response = await AuthAxios.get<BibleMeditationApiDto>('bible/meditations/by-verse', {
            signal,
            params: {
                bookCode: verse.bookCode,
                chapter: verse.chapter,
                verse: verse.verse,
            },
        })
        return toPrivateMeditation(response.data, verse)
    } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
            return null
        }
        throw error
    }
}

export async function savePrivateBibleMeditation(
    verse: BibleVerseSummary,
    request: SavePrivateBibleMeditationRequest,
    currentMeditation?: Pick<PrivateBibleMeditation, 'id' | 'version'>,
): Promise<PrivateBibleMeditation> {
    const response = currentMeditation
        ? await AuthAxios.patch<BibleMeditationApiDto>(
            `bible/meditations/${encodeURIComponent(currentMeditation.id)}`,
            {
                content: request.content,
                expectedVersion: currentMeditation.version,
                worshipAt: request.worshipAt ?? null,
                endVerse: request.endVerse,
            },
        )
        : await AuthAxios.post<BibleMeditationApiDto>('bible/meditations', {
            bookCode: verse.bookCode,
            chapter: verse.chapter,
            verse: verse.verse,
            endVerse: request.endVerse,
            content: request.content,
            worshipAt: request.worshipAt ?? null,
        })
    return toPrivateMeditation(response.data, verse)
}
