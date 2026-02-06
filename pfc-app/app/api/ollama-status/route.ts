import { NextRequest } from 'next/server';
import {
  getOllamaRunningModels,
  getOllamaModelInfo,
  estimateVram,
} from '@/lib/engine/llm/ollama';
import { execSync } from 'child_process';

function getGpuInfo(): { name: string; vramTotal: number; vramUsed: number } | null {
  try {
    const output = execSync(
      'nvidia-smi --query-gpu=name,memory.total,memory.used --format=csv,noheader,nounits',
      { timeout: 3000, encoding: 'utf-8' },
    );
    const parts = output.trim().split(',').map((s) => s.trim());
    if (parts.length < 3) return null;
    return {
      name: parts[0],
      vramTotal: parseInt(parts[1], 10) * 1024 * 1024,
      vramUsed: parseInt(parts[2], 10) * 1024 * 1024,
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const baseUrl = searchParams.get('baseUrl') || 'http://localhost:11434';

  const [running, tagsRes] = await Promise.all([
    getOllamaRunningModels(baseUrl),
    fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) }).catch(() => null),
  ]);

  let models: { name: string; estimatedVram: number; paramSize: string; quantization: string }[] = [];
  if (tagsRes && tagsRes.ok) {
    const tagsData = await tagsRes.json();
    const modelList: { name: string }[] = tagsData.models || [];

    const detailPromises = modelList.slice(0, 10).map(async (m) => {
      const detail = await getOllamaModelInfo(baseUrl, m.name);
      if (!detail) return null;
      return {
        name: m.name,
        estimatedVram: estimateVram(detail.paramSize, detail.quantization),
        paramSize: detail.paramSize,
        quantization: detail.quantization,
      };
    });

    const results = await Promise.all(detailPromises);
    models = results.filter((r): r is NonNullable<typeof r> => r !== null);
  }

  const gpu = getGpuInfo();

  return Response.json({
    running,
    gpu,
    models,
    timestamp: Date.now(),
  });
}
