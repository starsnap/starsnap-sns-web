const photoTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
const videoTypes = ['video/mp4', 'video/webm', 'video/quicktime']
const photoExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
const videoExtensions = ['.mp4', '.webm', '.mov']

export const chatMediaAccept = [...photoTypes, ...videoTypes, ...photoExtensions, ...videoExtensions].join(',')

export function validateChatMedia(file: Pick<File, 'name' | 'type' | 'size'>): string | null {
    const hasSpecificType = !!file.type && file.type !== 'application/octet-stream'
    const name = file.name.toLowerCase()
    const isPhoto = hasSpecificType ? photoTypes.includes(file.type) : photoExtensions.some((ext) => name.endsWith(ext))
    const isVideo = hasSpecificType ? videoTypes.includes(file.type) : videoExtensions.some((ext) => name.endsWith(ext))

    if (!isPhoto && !isVideo) return 'JPG, PNG, WebP, GIF, MP4, WebM, MOV 파일을 선택해주세요.'
    if (file.size === 0) return '빈 파일은 보낼 수 없어요.'
    const limit = isPhoto ? 15 : 50
    return file.size > limit * 1024 * 1024 ? `${isPhoto ? '사진' : '동영상'}은 ${limit} MiB까지 보낼 수 있어요.` : null
}
