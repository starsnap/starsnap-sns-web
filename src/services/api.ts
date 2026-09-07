import axios from 'axios';

function resolveApiBaseUrl(): string {
  const configuredBase = String(import.meta.env.VITE_API_BASE_URL || '').trim();
  const localApiHost = String(import.meta.env.VITE_PUBLIC_LOCAL_API_HOST || '').trim();
  const raw = configuredBase || (!import.meta.env.DEV ? localApiHost : '');
  if (!raw) return '/api';

  const ensureApiPath = (pathname: string) => {
    const normalized = pathname.replace(/\/+$/, '');
    if (!normalized || normalized === '/') return '/api';
    return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
  };

  try {
    const url = new URL(raw);
    const isLoopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (isLoopback && typeof window !== 'undefined') {
      url.hostname = window.location.hostname;
    }
    url.pathname = ensureApiPath(url.pathname);
    return url.toString().replace(/\/+$/, '');
  } catch {
    const withNoTrailingSlash = raw.replace(/\/+$/, '');
    if (!withNoTrailingSlash) return '/api';
    return withNoTrailingSlash.endsWith('/api')
      ? withNoTrailingSlash
      : `${withNoTrailingSlash}/api`;
  }
}

const API_BASE = resolveApiBaseUrl();

const client = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export type SignUpRequest = {
  username: string;
  email: string;
  password: string;
  token: string;
  displayName?: string;
  acceptTerms: boolean;
};

export type SignUpSuccess = {
  message?: string;
  status?: number;
  next?: string;
};

export type VerifyEmailSuccess = {
  email: string;
  token: string;
};

export type PasswordResetRequestSuccess = {
  message: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
};

export type PasswordResetVerifySuccess = {
  resetToken: string;
  expiresInSeconds: number;
};

export async function checkEmailAvailability(email: string): Promise<boolean> {
  const resp = await client.get('/auth/valid/email', { params: { email } });
  const data = resp.data;
  if (typeof data === 'boolean') return data;
  if (typeof data?.available === 'boolean') return data.available;
  if (typeof data?.status === 'number') return data.status >= 200 && data.status < 300;
  return resp.status >= 200 && resp.status < 300;
}

export async function checkUsernameAvailability(username: string): Promise<boolean> {
  const resp = await client.get('/auth/valid/username', { params: { username } });
  const data = resp.data;
  if (typeof data === 'boolean') return data;
  if (typeof data?.available === 'boolean') return data.available;
  if (typeof data?.status === 'number') return data.status >= 200 && data.status < 300;
  return resp.status >= 200 && resp.status < 300;
}

export async function sendEmailVerification(email: string): Promise<void> {
  await client.post('/auth/email/send', null, { params: { email } });
}

export async function verifyEmailCode(email: string, verifyCode: string): Promise<VerifyEmailSuccess> {
  const resp = await client.post('/auth/email/verify', { email, verifyCode });
  return resp.data as VerifyEmailSuccess;
}

export async function signUp(payload: SignUpRequest): Promise<SignUpSuccess> {
  const resp = await client.post('/auth/signup', payload);
  return resp.data as SignUpSuccess;
}

export async function requestPasswordReset(email: string): Promise<PasswordResetRequestSuccess> {
  const resp = await client.post('/auth/password-reset/request', { email });
  return resp.data as PasswordResetRequestSuccess;
}

export async function verifyPasswordResetCode(
  email: string,
  code: string,
): Promise<PasswordResetVerifySuccess> {
  const resp = await client.post('/auth/password-reset/verify', { email, code });
  return resp.data as PasswordResetVerifySuccess;
}

export async function confirmPasswordReset(resetToken: string, newPassword: string): Promise<void> {
  await client.post('/auth/password-reset/confirm', { resetToken, newPassword });
}

export default client;
