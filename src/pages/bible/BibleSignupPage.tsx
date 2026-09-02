import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import CustomAxios from '../../lib/axios/CustomAxios'

const USERNAME_PATTERN = /^[A-Za-z0-9]{4,20}$/
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,72}$/
const inputClass = 'w-full h-12 rounded-xl border border-line bg-panel px-4 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/30'

export default function BibleSignupPage() {
    const navigate = useNavigate()
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [acceptTerms, setAcceptTerms] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const usernameError = username && !USERNAME_PATTERN.test(username) ? '영문과 숫자로 4~20자를 입력해주세요.' : ''
    const passwordBytes = new TextEncoder().encode(password).length
    const passwordError = password && (!PASSWORD_PATTERN.test(password) || passwordBytes > 72)
        ? '대·소문자, 숫자, 특수문자를 포함해 8자 이상, 72바이트 이하로 입력해주세요.'
        : ''
    const confirmError = confirmPassword && password !== confirmPassword ? '비밀번호가 일치하지 않습니다.' : ''
    const valid = USERNAME_PATTERN.test(username) && PASSWORD_PATTERN.test(password) &&
        passwordBytes <= 72 && password === confirmPassword && acceptTerms

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!valid || loading) return
        setLoading(true)
        setError('')
        try {
            await CustomAxios.post('bible/auth/signup', { username, password, acceptTerms })
            navigate('/login', { replace: true })
        } catch (requestError: any) {
            const status = requestError?.response?.status
            setError(status === 429
                ? '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
                : status === 409
                    ? '이미 사용 중인 아이디입니다.'
                    : '가입하지 못했습니다. 입력 내용을 확인하고 다시 시도해주세요.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-[100dvh] flex items-center justify-center bg-canvas px-4 py-10">
            <div className="w-full max-w-[420px] rounded-[24px] border border-line bg-panel px-6 py-8 shadow-[var(--ss-shadow-md)] sm:px-9">
                <h1 className="text-center text-2xl font-extrabold text-ink">StarSnap Bible 가입</h1>
                <p className="mt-2 text-center text-sm text-sub">SNS와 공유하지 않는 Bible 전용 계정을 만듭니다.</p>

                <form className="mt-7 flex flex-col gap-4" onSubmit={submit}>
                    <label className="text-sm font-bold text-ink">
                        아이디
                        <input className={`${inputClass} mt-1.5`} value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder="영문·숫자 4~20자" aria-invalid={Boolean(usernameError)} aria-describedby={usernameError ? 'bible-username-error' : undefined} />
                        {usernameError && <span id="bible-username-error" className="mt-1 block font-normal text-danger" role="alert">{usernameError}</span>}
                    </label>
                    <label className="text-sm font-bold text-ink">
                        비밀번호
                        <input className={`${inputClass} mt-1.5`} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="대·소문자, 숫자, 특수문자 포함 8자 이상" aria-invalid={Boolean(passwordError)} aria-describedby={passwordError ? 'bible-password-error' : undefined} />
                        {passwordError && <span id="bible-password-error" className="mt-1 block font-normal text-danger" role="alert">{passwordError}</span>}
                    </label>
                    <label className="text-sm font-bold text-ink">
                        비밀번호 확인
                        <input className={`${inputClass} mt-1.5`} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" aria-invalid={Boolean(confirmError)} aria-describedby={confirmError ? 'bible-confirm-error' : undefined} />
                        {confirmError && <span id="bible-confirm-error" className="mt-1 block font-normal text-danger" role="alert">{confirmError}</span>}
                    </label>
                    <label className="flex min-h-11 items-center gap-3 text-sm text-ink">
                        <input type="checkbox" checked={acceptTerms} onChange={(event) => setAcceptTerms(event.target.checked)} className="h-5 w-5 accent-brand" />
                        Bible 서비스 이용을 위한 계정 생성에 동의합니다.
                    </label>

                    {error && <p className="text-sm text-danger" role="alert" aria-live="polite">{error}</p>}

                    <button className="h-12 cursor-pointer rounded-xl bg-brand font-bold text-on-brand disabled:cursor-not-allowed disabled:opacity-50" disabled={!valid || loading}>
                        {loading ? '가입 중…' : 'Bible 계정 만들기'}
                    </button>
                    <Link className="flex min-h-11 cursor-pointer items-center justify-center text-sm font-bold text-ink underline decoration-brand decoration-2 underline-offset-4" to="/login">
                        이미 계정이 있어요
                    </Link>
                </form>
            </div>
        </div>
    )
}
