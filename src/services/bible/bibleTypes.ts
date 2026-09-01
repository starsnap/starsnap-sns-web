export type BibleLicensePhase = 'pending' | 'active' | 'paused'

export type BibleLicenseStatus = {
    phase: BibleLicensePhase
    searchAvailable: boolean
    textDisplayAllowed: boolean
    notice?: string
    providerName?: string
    updatedAt?: string
}

export type BibleVerseSummary = {
    id: string
    bookCode: string
    bookName: string
    chapter: number
    verse: number
    reference?: string
    translation?: string
    text?: string
    displayAllowed: boolean
}

export type BibleSearchRequest = {
    query: string
    page?: number
    size?: number
}

export type BibleSearchResponse = {
    items: BibleVerseSummary[]
    page: number
    size: number
    hasNext: boolean
}

export type PrivateBibleMeditation = {
    id: string
    verseId: string
    endVerse: number
    content: string
    worshipAt?: string | null
    visibility: 'private'
    version: number
    createdAt: string
    updatedAt: string
}

export type SavePrivateBibleMeditationRequest = {
    content: string
    worshipAt?: string | null
    endVerse: number
}

export type BibleVerseApiDto = {
    translationCode: string
    translationName: string
    copyrightNotice: string
    bookCode: string
    bookName: string
    chapter: number
    verse: number
    text: string
}

export type BibleMeditationApiDto = {
    id: string
    bookCode: string
    chapter: number
    verse: number
    endVerse?: number
    content: string
    worshipAt?: string | null
    version: number
    createdAt: string
    modifiedAt: string
}

export type BibleSlice<T> = {
    content: T[]
    number: number
    size: number
    last: boolean
}
