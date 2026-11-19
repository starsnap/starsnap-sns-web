import axios, { AxiosHeaders } from 'axios';
import type { AxiosRequestConfig, AxiosError } from 'axios';
import token from '../token/token';

function resolveApiHost() {
    const raw = import.meta.env.VITE_PUBLIC_LOCAL_API_HOST || '';
    if (!raw) return '';

    try {
        const url = new URL(raw);
        const isLoopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
        if (isLoopback && typeof window !== 'undefined') {
            url.hostname = window.location.hostname;
            return url.origin;
        }
        return url.origin;
    } catch {
        return raw;
    }
}

const API_HOST = import.meta.env.DEV ? '' : resolveApiHost();

const AuthAxios = axios.create({
    withCredentials: true,
    baseURL: `${API_HOST}/api/`,
    timeout: 90000,
});

type RetryableAxiosRequestConfig = AxiosRequestConfig & {
    _retry?: boolean;
};

let refreshRequestPromise: Promise<void> | null = null;

AuthAxios.interceptors.request.use(
    function (config) {
        config.withCredentials = true;
        config.headers = AxiosHeaders.from(config.headers);
        config.headers.delete('Authorization');

        console.log(`[AuthAxios] ${config.method?.toUpperCase()} ${config.url}`, {
            withCredentials: config.withCredentials,
        });

        return Promise.resolve(config);
    },
    error => Promise.reject(error),
);

AuthAxios.interceptors.response.use(
    response => {
        return response;
    },

    async function (error) {
        const originalRequest = error.config as RetryableAxiosRequestConfig | undefined;
        if (!originalRequest || !error.response) {
            return Promise.reject(error);
        }

        const shouldRetryWithRefresh =
            !originalRequest._retry &&
            !isRefreshRequest(originalRequest.url) &&
            isAccessTokenExpiredError(error);

        if (!shouldRetryWithRefresh) {
            return Promise.reject(error);
        }

        originalRequest._retry = true;
        return reissueToken(originalRequest);
    }
)

function isRefreshRequest(url: string | undefined): boolean {
    if (!url) return false;
    return url.includes('/auth/refresh');
}

function isAccessTokenExpiredError(error: AxiosError): boolean {
    const status = error.response?.status;
    if (status !== 401 && status !== 403) {
        return false;
    }

    const data = error.response?.data as
        | { code?: unknown; message?: unknown; error?: unknown; reason?: unknown }
        | undefined;

    const code = typeof data?.code === 'string' ? data.code.toLowerCase() : '';
    if (code.includes('access') && (code.includes('expire') || code.includes('만료'))) {
        return true;
    }

    const messages = [data?.message, data?.error, data?.reason]
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.toLowerCase());

    const matchedByMessage = messages.some((message) => {
        const hasAccessTokenWord = message.includes('access token') || message.includes('액세스 토큰');
        const hasExpiredWord = message.includes('expire') || message.includes('만료');
        return hasAccessTokenWord && hasExpiredWord;
    });

    if (matchedByMessage) {
        return true;
    }

    // Some backend responses return bare 401 without body when access token is expired.
    // Retry refresh once on bare 401. _retry prevents infinite loops.
    return status === 401;
}

function requestTokenRefresh(): Promise<void> {
    if (!refreshRequestPromise) {
        refreshRequestPromise = axios
            .patch(
                `${API_HOST}/api/auth/refresh`,
                {},
                {
                    withCredentials: true,
                    headers: {
                        'Content-Type': 'application/json',
                    }
                }
            )
            .then((resp) => {
                console.log('✓ Token refreshed successfully', resp?.status);
            })
            .catch(err => {
                console.error('✗ Token refresh failed:', {
                    status: err.response?.status,
                    message: err.message,
                    headers: err.response?.headers,
                });

                if (err.response?.status === 401 || err.response?.status === 403) {
                    token.clear();
                    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
                        window.location.replace('/login');
                    }
                }

                return Promise.reject(err);
            })
            .finally(() => {
                refreshRequestPromise = null;
            });
    }

    return refreshRequestPromise;
}

async function reissueToken(originalRequest: RetryableAxiosRequestConfig) {
    await requestTokenRefresh();
    return AuthAxios(originalRequest);
}

export default AuthAxios;
