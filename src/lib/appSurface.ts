export type AppSurface = 'social' | 'chat'

const CHAT_HOSTNAME = 'chat.starsnap.kr'
const DEFAULT_SOCIAL_APP_URL = 'https://sns.starsnap.kr'

export function resolveAppSurface(
    hostname: string,
    configuredSurface = String(import.meta.env.VITE_APP_SURFACE || ''),
): AppSurface {
    const normalizedSurface = configuredSurface.trim().toLowerCase()
    if (normalizedSurface === 'chat') return 'chat'
    if (normalizedSurface === 'social') return 'social'

    const normalizedHostname = hostname.trim().toLowerCase()
    if (normalizedHostname === CHAT_HOSTNAME) return 'chat'

    return 'social'
}

export function getAppSurface(): AppSurface {
    const hostname = typeof window === 'undefined' ? '' : window.location.hostname
    return resolveAppSurface(hostname)
}

export function getSocialAppUrl(path = '/'): string {
    const configuredUrl = String(import.meta.env.VITE_SOCIAL_APP_URL || '').trim()
    const baseUrl = configuredUrl || DEFAULT_SOCIAL_APP_URL
    const normalizedPath = path.startsWith('/') ? path : `/${path}`

    try {
        return new URL(normalizedPath, `${baseUrl.replace(/\/+$/, '')}/`).toString()
    } catch {
        return new URL(normalizedPath, `${DEFAULT_SOCIAL_APP_URL}/`).toString()
    }
}
