import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckIcon, ChevronLeftIcon, ImageIcon } from '../../components/icons'
import { ProfileEditSkeleton } from '../../components/ui/EntitySkeletons'
import {
    changeProfileImage,
    changeUsername,
    getMyProfile,
    type UserProfileResponse,
} from '../../services/snapService'
import { queryKeys } from '../../services/queryKeys'
import { applyNextImageCandidate, getImageCandidates } from '../../utils/s3Image'
import { useUsernameCheck } from '../../hooks/useUsernameCheck'

const inputBase =
    'w-full h-11 rounded-lg border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-brand'

const USERNAME_REGEX = /^[a-zA-Z0-9]{4,12}$/

const resolveProfileImageKey = (profile: UserProfileResponse | null): string | null => {
    if (!profile) return null
    const savedKey = profile.profileImageUrl?.trim()
    return savedKey || null
}

const ProfileEditPage: React.FC = () => {
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const profileQuery = useQuery<UserProfileResponse>({
        queryKey: queryKeys.myProfile,
        queryFn: getMyProfile,
    })

    const profile = profileQuery.data ?? null
    const [username, setUsername] = useState('')
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    useEffect(() => {
        if (!profile) return
        setUsername(profile.username)
    }, [profile])

    const usernameValid = USERNAME_REGEX.test(username)
    const usernameChanged = username !== profile?.username
    const usernameCheck = useUsernameCheck(
        usernameValid && usernameChanged ? username : undefined,
        { debounceMs: 700 },
    )

    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl)
        }
    }, [previewUrl])

    const imageCandidates = useMemo(() => {
        if (previewUrl) return [previewUrl]
        return getImageCandidates(resolveProfileImageKey(profile))
    }, [previewUrl, profile])

    const openFilePicker = () => {
        if (saving) return
        fileInputRef.current?.click()
    }

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return

        if (!file.type.startsWith('image/')) {
            setErrorMessage('이미지 파일만 업로드할 수 있습니다.')
            return
        }

        if (file.size > 10 * 1024 * 1024) {
            setErrorMessage('프로필 이미지는 10MB 이하만 업로드할 수 있습니다.')
            return
        }

        setErrorMessage('')
        setSelectedFile(file)

        if (previewUrl) URL.revokeObjectURL(previewUrl)
        setPreviewUrl(URL.createObjectURL(file))
    }

    const handleSave = async () => {
        if (!profile || saving) return

        const nextUsername = username.trim()
        if (!nextUsername) {
            setErrorMessage('닉네임을 입력해주세요.')
            return
        }

        if (!USERNAME_REGEX.test(nextUsername)) {
            setErrorMessage('닉네임은 4~12자의 영문 또는 숫자만 가능합니다.')
            return
        }

        const usernameChanged = nextUsername !== profile.username
        const imageChanged = !!selectedFile

        if (usernameChanged && usernameCheck.available !== true) {
            setErrorMessage('닉네임 중복 확인을 완료해주세요.')
            return
        }

        if (!usernameChanged && !imageChanged) {
            navigate('/profile')
            return
        }

        setSaving(true)
        setErrorMessage('')

        try {
            if (imageChanged && selectedFile) {
                await changeProfileImage(selectedFile)
            }

            if (usernameChanged) {
                await changeUsername(nextUsername)
            }

            await queryClient.invalidateQueries({ queryKey: queryKeys.myProfile })
            navigate('/profile', { replace: true })
        } catch (err: any) {
            const msg =
                err?.response?.data?.message ||
                err?.response?.data ||
                err?.message ||
                '프로필 수정에 실패했습니다.'
            setErrorMessage(String(msg))
        } finally {
            setSaving(false)
        }
    }

    if (profileQuery.isLoading) {
        return <ProfileEditSkeleton />
    }

    if (!profile) {
        return <div className="px-4 py-5 text-sm text-danger sm:px-6 sm:py-7 lg:px-8">프로필 정보를 찾을 수 없습니다.</div>
    }

    return (
        <div className="max-w-[760px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-1.5 text-sm text-sub hover:text-ink"
            >
                <ChevronLeftIcon size={16} />
                뒤로가기
            </button>

            <h1 className="text-2xl font-bold text-ink mt-4">프로필 수정</h1>

            <div className="mt-6 rounded-2xl border border-line bg-panel p-6">
                <input
                    ref={fileInputRef}
                    id="profile-image-input"
                    name="profileImage"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                />

                <div className="flex items-center gap-5">
                    <div className="relative">
                        {imageCandidates.length > 0 ? (
                            <img
                                src={imageCandidates[0]}
                                alt="프로필 이미지"
                                width={96}
                                height={96}
                                className="w-24 h-24 rounded-full object-cover border border-line"
                                onError={(e) => applyNextImageCandidate(e.currentTarget, imageCandidates)}
                            />
                        ) : (
                            <span className="w-24 h-24 rounded-full bg-placeholder border border-line inline-block" />
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={openFilePicker}
                        className="h-10 px-4 rounded-lg border border-line text-sm font-bold text-sub hover:text-ink inline-flex items-center gap-2"
                    >
                        <ImageIcon size={16} />
                        사진 변경
                    </button>
                </div>

                <div className="mt-6">
                    <label htmlFor="profile-username" className="block text-sm font-bold text-ink mb-2">닉네임</label>
                    <div className="relative">
                        <input
                            id="profile-username"
                            name="username"
                            autoComplete="username"
                            spellCheck={false}
                            aria-describedby="profile-username-status"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className={`${inputBase} pr-11`}
                            placeholder="닉네임 입력"
                        />
                        {usernameValid && usernameChanged && usernameCheck.available === true && (
                                <CheckIcon size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-success" />
                        )}
                    </div>
                    <p
                        id="profile-username-status"
                        aria-live="polite"
                        className={`mt-1 text-xs ${
                            username.length > 0 && !usernameValid
                                ? 'text-danger'
                                : usernameChanged && usernameCheck.available === false
                                ? 'text-danger'
                                : usernameChanged && usernameCheck.available === true
                                    ? 'text-success'
                                : 'text-muted'
                        }`}
                    >
                        {username.length > 0 && !usernameValid
                            ? '닉네임은 4~12자의 영문/숫자만 가능합니다.'
                            : usernameChanged && usernameValid && usernameCheck.loading
                            ? '닉네임 중복 확인 중…'
                            : usernameChanged && usernameCheck.available === false
                            ? '이미 사용중인 닉네임입니다.'
                            : usernameChanged && usernameCheck.available === true
                            ? '사용 가능한 닉네임입니다.'
                            : usernameCheck.error
                            ? usernameCheck.error
                            : '4~12자의 영문/숫자만 입력 가능합니다.'}
                    </p>
                </div>

                <div className="mt-4">
                    <label htmlFor="profile-email" className="block text-sm font-bold text-ink mb-2">이메일</label>
                    <input id="profile-email" name="email" type="email" autoComplete="email" value={profile.email} disabled className={`${inputBase} opacity-70 cursor-not-allowed`} />
                </div>

                {errorMessage && <p className="mt-4 text-sm text-danger" role="alert">{errorMessage}</p>}

                <div className="mt-6 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="h-11 px-5 rounded-lg border border-line text-sm font-bold text-sub hover:text-ink"
                        disabled={saving}
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={saving || (usernameChanged && usernameCheck.available !== true)}
                        className="h-11 px-5 rounded-lg bg-brand text-on-brand text-sm font-bold hover:brightness-95 disabled:opacity-60"
                    >
                        {saving ? '저장 중…' : '저장'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ProfileEditPage
