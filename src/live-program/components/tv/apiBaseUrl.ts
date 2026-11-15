function formatHostForUrl(hostname: string): string {
  if (!hostname) {
    return '127.0.0.1';
  }

  // Bracket IPv6 hosts when building URLs like http://[::1]:3000
  return hostname.includes(':') ? `[${hostname}]` : hostname;
}

function getDevDefaultApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://127.0.0.1:3000';
  }

  const host = formatHostForUrl(window.location.hostname);
  return `http://${host}:3000`;
}

const env = (typeof import.meta !== 'undefined' && (import.meta as any).env) ? (import.meta as any).env : {};
export const API_BASE_URL = env.VITE_API_BASE_URL || (env.DEV ? getDevDefaultApiBaseUrl() : 'http://127.0.0.1:3000');

export function getApiBaseUrl(): string {
  return (API_BASE_URL || getDevDefaultApiBaseUrl()).replace(/\/$/, '');
}

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}
