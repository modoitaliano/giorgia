/// <reference types="vite/client" />
import './style.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import LiveProgram from '../components/live-program/LiveProgram.js';

// The live-program components live in src/components/live-program (this
// directory holds only the app entry); tests are not part of the bundle.
export const discoveredComponents = import.meta.glob(
  ['../components/live-program/**/*.{ts,tsx}', '!../components/live-program/**/*.test.{ts,tsx}', '!../components/live-program/**/*.d.ts'],
  { eager: true }
);

export interface RuntimeParameters {
  programId: string;
  apiBaseUrl: string | undefined;
}

export function parseRuntimeParameters(
  search: string = window.location.search,
  fallbackApiUrl?: string
): RuntimeParameters {
  const query = new URLSearchParams(search);
  const runtimeConfig = (window as unknown as { __MODOITALIANO_LIVE_PROGRAM_CONFIG__?: Partial<RuntimeParameters> }).__MODOITALIANO_LIVE_PROGRAM_CONFIG__;
  const programId = runtimeConfig?.programId || query.get('programId') || 'modoitaliano';
  const apiBaseUrl = runtimeConfig?.apiBaseUrl || query.get('apiBaseUrl') || fallbackApiUrl;
  return { programId, apiBaseUrl };
}

export function mountLiveProgram(
  rootElement: HTMLElement | null = document.getElementById('root'),
  search: string = window.location.search,
  fallbackApiUrl?: string
): boolean {
  if (!rootElement) {
    return false;
  }
  const { programId, apiBaseUrl } = parseRuntimeParameters(search, fallbackApiUrl);
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <LiveProgram programId={programId} apiBaseUrl={apiBaseUrl} />
    </React.StrictMode>
  );
  return true;
}

mountLiveProgram(document.getElementById('root'), window.location.search, import.meta.env?.VITE_API_BASE_URL);
