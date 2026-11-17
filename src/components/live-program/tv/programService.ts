/** Asks the program's API to take a scene; a failure is ignored. */
export async function activateScene(
  apiBaseUrl: string,
  targetProgramId: string,
  sceneId: number,
  transitionId?: string | null
): Promise<void> {
  try {
    const url = `${apiBaseUrl.replace(/\/+$/, '')}/program/${encodeURIComponent(targetProgramId)}/activate`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sceneId, transitionId })
    });
  } catch {
    // Non-fatal broadcast activation fallback
  }
}
