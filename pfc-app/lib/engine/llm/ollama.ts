// ═══════════════════════════════════════════════════════════════════
// ██ OLLAMA — Health Check & Model Discovery
// ═══════════════════════════════════════════════════════════════════

export interface OllamaStatus {
  available: boolean;
  models: string[];
}

export async function checkOllamaAvailability(
  baseUrl = 'http://localhost:11434',
): Promise<OllamaStatus> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return { available: false, models: [] };
    const data = await response.json();
    const models = (data.models || []).map((m: { name: string }) => m.name);
    return { available: true, models };
  } catch {
    return { available: false, models: [] };
  }
}
