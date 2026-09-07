import { useEffect, useRef, useState } from 'react';
import type { AxiosError } from 'axios';
import { useNavigate } from 'react-router-dom';
import { queryClient } from '../../lib/query/queryClient';
import token from '../../lib/token/token';
import {
    confirmPasswordReset,
    requestPasswordReset,
    verifyPasswordResetCode,
} from '../../services/api';

type Step = 'email' | 'code' | 'password' | 'success';
type ErrorPayload = { message?: string };
type ErrorField = 'email' | 'code' | 'password' | 'confirmation' | 'form';
type FieldError = { field: ErrorField; message: string } | null;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[~\u2024!@#$%^&*()_\-+=|\\;:\u2018\u201C<>,.?/]).{8,50}$/;
const GENERIC_REQUEST_MESSAGE = '해당 이메일로 가입된 계정이 있다면 인증코드를 보냈습니다.';

function responseMessage(error: unknown, fallback: string): string {
    const axiosError = error as AxiosError<ErrorPayload>;
    return axiosError.response?.data?.message || fallback;
}

function retryAfterSeconds(error: unknown): number {
    const axiosError = error as AxiosError;
    const value = Number(axiosError.response?.headers?.['retry-after']);
    return Number.isFinite(value) && value > 0 ? Math.ceil(value) : 0;
}

const inputClass =
    'h-12 w-full rounded-xl border border-line bg-panel px-4 text-sm text-ink placeholder:text-muted hover:border-muted focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-60';

const ForgotPasswordPage = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState<Step>('email');
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [resetToken, setResetToken] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [busy, setBusy] = useState(false);
    const [fieldError, setFieldError] = useState<FieldError>(null);
    const [statusMessage, setStatusMessage] = useState('');
    const [resendAvailableAt, setResendAvailableAt] = useState(0);
    const [resendRemaining, setResendRemaining] = useState(0);

    const emailRef = useRef<HTMLInputElement>(null);
    const codeRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);
    const passwordConfirmationRef = useRef<HTMLInputElement>(null);
    const successHeadingRef = useRef<HTMLHeadingElement>(null);

    useEffect(() => {
        const previousTitle = document.title;
        document.title = '비밀번호 재설정 · StarSnap';
        return () => {
            document.title = previousTitle;
        };
    }, []);

    useEffect(() => {
        if (step === 'email') emailRef.current?.focus();
        if (step === 'code') codeRef.current?.focus();
        if (step === 'password') passwordRef.current?.focus();
        if (step === 'success') successHeadingRef.current?.focus();
    }, [step]);

    useEffect(() => {
        if (!resendAvailableAt) {
            setResendRemaining(0);
            return;
        }
        const update = () => {
            const remaining = Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000));
            setResendRemaining(remaining);
            if (remaining === 0) setResendAvailableAt(0);
        };
        update();
        const timer = window.setInterval(update, 1000);
        return () => window.clearInterval(timer);
    }, [resendAvailableAt]);

    const goToLogin = () => {
        setResetToken('');
        setPassword('');
        setPasswordConfirmation('');
        navigate('/login', { replace: true });
    };

    const restart = () => {
        setStep('email');
        setCode('');
        setResetToken('');
        setPassword('');
        setPasswordConfirmation('');
        setFieldError(null);
        setStatusMessage('');
        setResendAvailableAt(0);
    };

    const sendCode = async () => {
        const activeCooldown = Math.max(
            resendRemaining,
            Math.ceil((resendAvailableAt - Date.now()) / 1000),
        );
        if (activeCooldown > 0) {
            setFieldError({ field: 'form', message: `${activeCooldown}초 후에 다시 요청해주세요.` });
            window.setTimeout(() => (step === 'code' ? codeRef.current : emailRef.current)?.focus(), 0);
            return;
        }
        const normalizedEmail = email.trim();
        if (!EMAIL_PATTERN.test(normalizedEmail) || normalizedEmail.length > 254) {
            setFieldError({ field: 'email', message: '올바른 이메일 주소를 입력해주세요.' });
            emailRef.current?.focus();
            return;
        }

        setBusy(true);
        setFieldError(null);
        try {
            const result = await requestPasswordReset(normalizedEmail);
            setEmail(normalizedEmail);
            setCode('');
            setStatusMessage(result.message || GENERIC_REQUEST_MESSAGE);
            setResendAvailableAt(Date.now() + result.resendAfterSeconds * 1000);
            setStep('code');
        } catch (error) {
            const retryAfter = retryAfterSeconds(error);
            if (retryAfter) setResendAvailableAt(Date.now() + retryAfter * 1000);
            setFieldError({
                field: 'form',
                message: responseMessage(error, '인증코드를 요청하지 못했습니다. 잠시 후 다시 시도해주세요.'),
            });
            window.setTimeout(() => emailRef.current?.focus(), 0);
        } finally {
            setBusy(false);
        }
    };

    const verifyCode = async () => {
        if (!/^\d{6}$/.test(code)) {
            setFieldError({ field: 'code', message: '이메일로 받은 6자리 인증코드를 입력해주세요.' });
            codeRef.current?.focus();
            return;
        }

        setBusy(true);
        setFieldError(null);
        try {
            const result = await verifyPasswordResetCode(email, code);
            setResetToken(result.resetToken);
            setCode('');
            setStatusMessage('이메일 인증이 완료되었습니다. 새 비밀번호를 입력해주세요.');
            setStep('password');
        } catch (error) {
            setFieldError({
                field: 'code',
                message: responseMessage(error, '인증코드가 올바르지 않거나 만료되었습니다.'),
            });
            window.setTimeout(() => {
                codeRef.current?.focus();
                codeRef.current?.select();
            }, 0);
        } finally {
            setBusy(false);
        }
    };

    const confirmReset = async () => {
        if (!PASSWORD_PATTERN.test(password)) {
            setFieldError({
                field: 'password',
                message: '영문 대소문자, 숫자, 특수문자를 포함하여 8~50자로 입력해주세요.',
            });
            passwordRef.current?.focus();
            return;
        }
        if (!passwordConfirmation) {
            setFieldError({ field: 'confirmation', message: '비밀번호 확인을 입력해주세요.' });
            passwordConfirmationRef.current?.focus();
            return;
        }
        if (password !== passwordConfirmation) {
            setFieldError({ field: 'confirmation', message: '비밀번호가 일치하지 않습니다.' });
            passwordConfirmationRef.current?.focus();
            return;
        }

        setBusy(true);
        setFieldError(null);
        try {
            await confirmPasswordReset(resetToken, password);
            token.clear();
            queryClient.clear();
            setResetToken('');
            setPassword('');
            setPasswordConfirmation('');
            setStatusMessage('비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.');
            setStep('success');
        } catch (error) {
            setFieldError({
                field: 'form',
                message: responseMessage(error, '재설정 요청이 만료되었거나 이미 사용되었습니다. 다시 요청해주세요.'),
            });
            window.setTimeout(() => passwordRef.current?.focus(), 0);
        } finally {
            setBusy(false);
        }
    };

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (busy) return;
        if (step === 'email') void sendCode();
        if (step === 'code') void verifyCode();
        if (step === 'password') void confirmReset();
    };

    const title = step === 'email'
        ? '비밀번호 찾기'
        : step === 'code'
            ? '인증코드 확인'
            : step === 'password'
                ? '새 비밀번호 설정'
                : '비밀번호 변경 완료';

    return (
        <main
            className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-4 py-8"
            style={{
                background: 'radial-gradient(circle at 18% 14%, var(--ss-brand-soft) 0, transparent 30%), radial-gradient(circle at 86% 86%, var(--ss-border) 0, transparent 34%), var(--ss-canvas)',
            }}
        >
            <section
                aria-labelledby="password-reset-title"
                className="w-full max-w-[440px] rounded-[24px] border border-line bg-panel px-6 py-8 shadow-[var(--ss-shadow-md)] sm:px-9 sm:py-10"
            >
                <div className="text-center">
                    <img
                        src="/icon-96.png"
                        alt=""
                        aria-hidden="true"
                        width={96}
                        height={96}
                        className="mx-auto h-11 w-11 rounded-xl object-cover"
                    />
                    <h1
                        ref={successHeadingRef}
                        id="password-reset-title"
                        tabIndex={step === 'success' ? -1 : undefined}
                        className="mt-4 text-2xl font-extrabold tracking-tight text-ink"
                    >
                        {title}
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-sub">
                        {step === 'email' && '가입할 때 사용한 이메일을 입력해주세요.'}
                        {step === 'code' && `${email}로 받은 코드를 입력해주세요.`}
                        {step === 'password' && '다른 곳에서 사용하지 않는 안전한 비밀번호를 설정해주세요.'}
                        {step === 'success' && statusMessage}
                    </p>
                </div>

                {step === 'success' ? (
                    <button
                        type="button"
                        onClick={goToLogin}
                        className="mt-8 h-12 w-full rounded-xl bg-brand font-bold text-on-brand shadow-sm hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                        로그인으로 돌아가기
                    </button>
                ) : (
                    <form className="mt-7 space-y-5" onSubmit={handleSubmit} aria-busy={busy || undefined} noValidate>
                        {step === 'email' && (
                            <div>
                                <label htmlFor="password-reset-email" className="mb-1.5 block text-sm font-bold text-ink">이메일</label>
                                <input
                                    ref={emailRef}
                                    id="password-reset-email"
                                    name="email"
                                    type="email"
                                    inputMode="email"
                                    autoComplete="email"
                                    autoCapitalize="none"
                                    spellCheck={false}
                                    maxLength={254}
                                    value={email}
                                    disabled={busy}
                                    aria-invalid={fieldError?.field === 'email' || undefined}
                                    aria-describedby={fieldError?.field === 'email' ? 'password-reset-email-error' : undefined}
                                    onChange={(event) => {
                                        setEmail(event.target.value);
                                        setFieldError(null);
                                    }}
                                    className={inputClass}
                                    placeholder="name@example.com"
                                />
                                {fieldError?.field === 'email' ? (
                                    <p id="password-reset-email-error" role="alert" className="mt-2 text-sm leading-6 text-danger">
                                        {fieldError.message}
                                    </p>
                                ) : null}
                            </div>
                        )}

                        {step === 'code' && (
                            <div>
                                <label htmlFor="password-reset-code" className="mb-1.5 block text-sm font-bold text-ink">인증코드</label>
                                <input
                                    ref={codeRef}
                                    id="password-reset-code"
                                    name="code"
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    pattern="[0-9]{6}"
                                    maxLength={6}
                                    value={code}
                                    disabled={busy}
                                    aria-invalid={fieldError?.field === 'code' || undefined}
                                    aria-describedby={fieldError?.field === 'code'
                                        ? 'password-reset-status password-reset-code-error'
                                        : 'password-reset-status'}
                                    onChange={(event) => {
                                        setCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                                        setFieldError(null);
                                    }}
                                    className={`${inputClass} text-center font-mono text-lg tracking-[0.28em]`}
                                    placeholder="000000"
                                />
                                {fieldError?.field === 'code' ? (
                                    <p id="password-reset-code-error" role="alert" className="mt-2 text-sm leading-6 text-danger">
                                        {fieldError.message}
                                    </p>
                                ) : null}
                                <div className="mt-2 flex min-h-11 items-center justify-between gap-3 text-sm">
                                    <button
                                        type="button"
                                        onClick={restart}
                                        disabled={busy}
                                        className="min-h-11 rounded-lg px-1.5 font-semibold text-sub underline underline-offset-4"
                                    >
                                        이메일 다시 입력
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void sendCode()}
                                        disabled={busy || resendRemaining > 0}
                                        className="min-h-11 rounded-lg px-1.5 font-semibold text-ink underline decoration-brand decoration-2 underline-offset-4 disabled:text-muted"
                                    >
                                        {resendRemaining > 0 ? `${resendRemaining}초 후 재전송` : '인증코드 재전송'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 'password' && (
                            <>
                                <div>
                                    <label htmlFor="password-reset-new" className="mb-1.5 block text-sm font-bold text-ink">새 비밀번호</label>
                                    <input
                                        ref={passwordRef}
                                        id="password-reset-new"
                                        name="newPassword"
                                        type="password"
                                        autoComplete="new-password"
                                        maxLength={50}
                                        value={password}
                                        disabled={busy}
                                        aria-invalid={fieldError?.field === 'password' || undefined}
                                        aria-describedby={fieldError?.field === 'password'
                                            ? 'password-reset-password-help password-reset-password-error'
                                            : 'password-reset-password-help'}
                                        onChange={(event) => {
                                            setPassword(event.target.value);
                                            setFieldError(null);
                                        }}
                                        className={inputClass}
                                        placeholder="새 비밀번호 입력"
                                    />
                                    <p id="password-reset-password-help" className="mt-2 text-xs leading-5 text-muted">
                                        영문 대소문자, 숫자, 특수문자를 포함한 8~50자
                                    </p>
                                    {fieldError?.field === 'password' ? (
                                        <p id="password-reset-password-error" role="alert" className="mt-1 text-sm leading-6 text-danger">
                                            {fieldError.message}
                                        </p>
                                    ) : null}
                                </div>
                                <div>
                                    <label htmlFor="password-reset-confirmation" className="mb-1.5 block text-sm font-bold text-ink">새 비밀번호 확인</label>
                                    <input
                                        ref={passwordConfirmationRef}
                                        id="password-reset-confirmation"
                                        name="passwordConfirmation"
                                        type="password"
                                        autoComplete="new-password"
                                        maxLength={50}
                                        value={passwordConfirmation}
                                        disabled={busy}
                                        aria-invalid={fieldError?.field === 'confirmation' || undefined}
                                        aria-describedby={fieldError?.field === 'confirmation'
                                            ? 'password-reset-confirmation-error'
                                            : undefined}
                                        onChange={(event) => {
                                            setPasswordConfirmation(event.target.value);
                                            setFieldError(null);
                                        }}
                                        className={inputClass}
                                        placeholder="새 비밀번호 다시 입력"
                                    />
                                    {fieldError?.field === 'confirmation' ? (
                                        <p id="password-reset-confirmation-error" role="alert" className="mt-2 text-sm leading-6 text-danger">
                                            {fieldError.message}
                                        </p>
                                    ) : null}
                                </div>
                            </>
                        )}

                        {statusMessage && step !== 'password' && (
                            <p id="password-reset-status" role="status" aria-live="polite" className="text-sm leading-6 text-sub">
                                {statusMessage}
                            </p>
                        )}
                        {fieldError?.field === 'form' ? (
                            <div>
                                <p id="password-reset-error" role="alert" className="text-sm leading-6 text-danger">
                                    {fieldError.message}
                                </p>
                                {step === 'password' ? (
                                    <button
                                        type="button"
                                        onClick={restart}
                                        className="mt-1 min-h-11 rounded-lg px-1.5 text-sm font-semibold text-ink underline decoration-brand decoration-2 underline-offset-4"
                                    >
                                        처음부터 다시 인증하기
                                    </button>
                                ) : null}
                            </div>
                        ) : null}

                        <button
                            type="submit"
                            disabled={busy || (step === 'email' && resendRemaining > 0)}
                            className="h-12 w-full rounded-xl bg-brand font-bold text-on-brand shadow-sm hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {busy
                                ? '처리 중…'
                                : step === 'email'
                                    ? resendRemaining > 0
                                        ? `${resendRemaining}초 후 다시 요청`
                                        : '인증코드 받기'
                                    : step === 'code'
                                        ? '인증코드 확인'
                                        : '비밀번호 변경'}
                        </button>
                        <button
                            type="button"
                            onClick={goToLogin}
                            disabled={busy}
                            className="min-h-11 w-full rounded-lg px-3 text-sm font-semibold text-sub underline underline-offset-4"
                        >
                            로그인으로 돌아가기
                        </button>
                    </form>
                )}
            </section>
        </main>
    );
};

export default ForgotPasswordPage;
