import { NextRequest } from 'next/server';
import { evaluateMLProject, type MLProjectInput } from '@/lib/engine/ml-evaluator';

export async function POST(request: NextRequest) {
  try {
    const input: MLProjectInput = await request.json();

    if (!input.name || !input.description) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: name, description' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const evaluation = evaluateMLProject(input);

    return Response.json(evaluation);
  } catch (error) {
    console.error('[evaluate/route] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Evaluation failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
