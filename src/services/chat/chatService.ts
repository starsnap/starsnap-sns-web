import AuthAxios from '../../lib/axios/AuthAxios'

export type ChatMessageStatus = 'NORMAL' | 'EDITED' | 'DELETED'

export type ChatAttachment = {
    contentType: string
    size: number
    hasCaption: boolean
}

export type ChatMessage = {
    id: string
    roomId: string
    senderUserId: string
    senderUsername: string
    content: string
    status: ChatMessageStatus
    createdAt: string
    attachment?: ChatAttachment | null
}

export type ChatMessageHistoryPage = {
    messages: ChatMessage[]
    hasMore: boolean
}

export type ChatTypingFrame = {
    type: 'typing'
    roomId: string
    senderUserId: string
    isTyping: boolean
}

export type ChatRoomMember = {
    userId: string
    username: string
    profileImageUrl: string | null
}

export type ChatRoomLastMessage = {
    id: string
    senderUserId: string
    senderUsername: string
    content: string
    status: ChatMessageStatus
    createdAt: string
    attachment?: ChatAttachment | null
}

export type ChatRoomSummary = {
    roomId: string
    title: string | null
    members: ChatRoomMember[]
    lastMessage: ChatRoomLastMessage | null
    lastMessageAt: string
}

export type ChatSendPayload = {
    roomId: string
    content: string
}

export type ChatUpdatePayload = {
    content: string
}

export type ChatRoomCreatePayload = {
    title?: string
    memberUserIds: string[]
}

export type ChatMessageUpdatedFrame = {
    type: 'message-updated'
    message: ChatMessage
}

export type ChatMessageDeletedFrame = {
    type: 'message-deleted'
    messageId: string
    roomId: string
    senderUserId: string
    status: ChatMessageStatus
}

export type ChatMessageRateLimitedFrame = {
    type: 'message-rate-limited'
    code: 'MESSAGE_RATE_LIMITED'
    status: 429
    roomId: string
    content: string
    retryAfterSeconds: number
    message: string
}

export async function getChatRooms(): Promise<ChatRoomSummary[]> {
    const resp = await AuthAxios.get<ChatRoomSummary[]>('message/rooms')
    return resp.data
}

export async function getChatHistory(
    roomId: string,
    beforeMessageId?: string,
    size = 50,
): Promise<ChatMessageHistoryPage> {
    const resp = await AuthAxios.get<ChatMessageHistoryPage>('message/history', {
        params: {
            'room-id': roomId,
            'before-message-id': beforeMessageId,
            size,
        },
    })
    return resp.data
}

export async function createChatRoom(payload: ChatRoomCreatePayload): Promise<ChatRoomSummary> {
    const resp = await AuthAxios.post<ChatRoomSummary>('message/rooms', payload)
    return resp.data
}

export async function addChatRoomMembers(roomId: string, userIds: string[]): Promise<ChatRoomSummary> {
    const resp = await AuthAxios.post<ChatRoomSummary>(
        `message/rooms/${encodeURIComponent(roomId)}/members`,
        { userIds },
    )
    return resp.data
}

export async function leaveChatRoom(roomId: string): Promise<void> {
    await AuthAxios.delete(`message/rooms/${encodeURIComponent(roomId)}/members/me`)
}

export async function sendChatMessage(payload: ChatSendPayload): Promise<ChatMessage> {
    const resp = await AuthAxios.post<ChatMessage>('message/send', payload)
    return resp.data
}

export async function sendChatAttachment(roomId: string, file: File, content: string): Promise<ChatMessage> {
    const payload = new FormData()
    payload.append('file', file)
    if (content) payload.append('content', content)
    const resp = await AuthAxios.post<ChatMessage>(`message/rooms/${encodeURIComponent(roomId)}/media`, payload, {
        headers: { 'X-Chat-Media': '1' },
        timeout: 300_000,
    })
    return resp.data
}

export function getChatAttachmentUrl(roomId: string, messageId: string): string {
    return `/api/message/rooms/${encodeURIComponent(roomId)}/media/${encodeURIComponent(messageId)}`
}

export async function updateChatMessage(
    messageId: string,
    payload: ChatUpdatePayload,
): Promise<ChatMessage> {
    const resp = await AuthAxios.put<ChatMessage>(`message/${encodeURIComponent(messageId)}`, payload)
    return resp.data
}

export async function deleteChatMessage(messageId: string): Promise<void> {
    await AuthAxios.delete(`message/${encodeURIComponent(messageId)}`)
}

function resolveWsBaseUrl(): string {
    const configured = String(import.meta.env.VITE_WS_BASE_URL || '').trim()
    if (configured) {
        if (configured.startsWith('http://')) return configured.replace('http://', 'ws://')
        if (configured.startsWith('https://')) return configured.replace('https://', 'wss://')
        return configured
    }

    if (typeof window === 'undefined') return 'ws://localhost:8080'

    if (import.meta.env.DEV) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        return `${protocol}//${window.location.host}`
    }

    const apiHost = String(import.meta.env.VITE_PUBLIC_LOCAL_API_HOST || '').trim()
    if (apiHost) {
        try {
            const url = new URL(apiHost)
            if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
                url.hostname = window.location.hostname
            }
            const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
            return `${protocol}//${url.host}`
        } catch {
            // fallback below
        }
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}`
}

export function createChatWebSocket(): WebSocket {
    const base = resolveWsBaseUrl().replace(/\/+$/, '')
    return new WebSocket(`${base}/ws-chat`)
}

export function isChatTypingFrame(value: unknown): value is ChatTypingFrame {
    if (!value || typeof value !== 'object') return false

    const frame = value as Partial<ChatTypingFrame>
    return (
        frame.type === 'typing' &&
        typeof frame.roomId === 'string' &&
        typeof frame.senderUserId === 'string' &&
        typeof frame.isTyping === 'boolean'
    )
}

export function isChatMessageUpdatedFrame(value: unknown): value is ChatMessageUpdatedFrame {
    if (!value || typeof value !== 'object') return false
    const frame = value as Partial<ChatMessageUpdatedFrame>
    return frame.type === 'message-updated' && !!frame.message && typeof frame.message.id === 'string'
}

export function isChatMessageDeletedFrame(value: unknown): value is ChatMessageDeletedFrame {
    if (!value || typeof value !== 'object') return false
    const frame = value as Partial<ChatMessageDeletedFrame>
    return frame.type === 'message-deleted' && typeof frame.messageId === 'string'
}

export function isChatMessageRateLimitedFrame(value: unknown): value is ChatMessageRateLimitedFrame {
    if (!value || typeof value !== 'object') return false
    const frame = value as Partial<ChatMessageRateLimitedFrame>
    return (
        frame.type === 'message-rate-limited' &&
        frame.code === 'MESSAGE_RATE_LIMITED' &&
        frame.status === 429 &&
        typeof frame.roomId === 'string' &&
        frame.roomId.length > 0 &&
        typeof frame.content === 'string' &&
        frame.content.trim().length > 0 &&
        typeof frame.retryAfterSeconds === 'number' &&
        Number.isFinite(frame.retryAfterSeconds) &&
        frame.retryAfterSeconds > 0 &&
        typeof frame.message === 'string'
    )
}

export function sendChatTyping(socket: WebSocket, roomId: string, isTyping: boolean): boolean {
    if (socket.readyState !== WebSocket.OPEN) return false

    try {
        socket.send(JSON.stringify({ type: 'typing', roomId, isTyping }))
        return true
    } catch {
        return false
    }
}
