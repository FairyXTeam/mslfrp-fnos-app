import axios from 'axios';

let authToken = localStorage.getItem('msl_auth_token') || '';

export function getAuthToken(): string {
  return authToken;
}

export function setAuthToken(token: string) {
  authToken = token;
  if (token) {
    localStorage.setItem('msl_auth_token', token);
  } else {
    localStorage.removeItem('msl_auth_token');
  }
}

// Automatically detect gateway base URL (e.g. /app/mslfrp)
function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    if (window.location.pathname.startsWith('/app/mslfrp')) {
      return '/app/mslfrp';
    }
    if (window.location.pathname.includes('/index.cgi')) {
      const idx = window.location.pathname.indexOf('/index.cgi');
      return window.location.pathname.slice(0, idx + 10);
    }
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return '';
    }
  }
  return '/app/mslfrp';
}

const apiClient = axios.create({
  baseURL: getBaseUrl(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

apiClient.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const errorMsg = error.response?.data?.msg || error.message || '网络请求错误';
    return Promise.reject(new Error(errorMsg));
  }
);

export async function get<T = any>(url: string, params?: any): Promise<T> {
  return apiClient.get(url, { params });
}

export async function post<T = any>(url: string, data?: any): Promise<T> {
  return apiClient.post(url, data);
}

export async function del<T = any>(url: string, data?: any): Promise<T> {
  return apiClient.delete(url, { data });
}

export default {
  get,
  post,
  del,
  getAuthToken,
  setAuthToken
};
