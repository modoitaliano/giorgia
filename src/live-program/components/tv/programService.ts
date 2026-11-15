import { apiUrl } from './apiBaseUrl.js';

export async function activateScene(
  targetProgramId: string,
  sceneId: number,
  transitionId?: string | null
): Promise<void> {
  try {
    const url = apiUrl(`/program/${encodeURIComponent(targetProgramId)}/activate`);
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sceneId, transitionId })
    });
  } catch {
    // Non-fatal broadcast activation fallback
  }
}
