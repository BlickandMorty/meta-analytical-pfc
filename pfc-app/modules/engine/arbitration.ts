import type { StageResult, PipelineStage } from '../store/usePFCStore';
import type { ArbitrationResult, EngineVote } from './types';

interface VoteConfig {
  stage: PipelineStage;
  supportKeywords: string[];
  opposeKeywords: string[];
}

const VOTE_CONFIGS: VoteConfig[] = [
  {
    stage: 'statistical',
    supportKeywords: ['large effect', 'power = 0.9', 'power = 0.8', 'MCID exceeded', 'p < 0.001'],
    opposeKeywords: ['negligible', 'underpowered', 'effect size negligible'],
  },
  {
    stage: 'causal',
    supportKeywords: ['strong causal', 'RCT design', 'Hill=0.8', 'Hill=0.9'],
    opposeKeywords: ['confounders identified', 'uncontrolled', 'moderate causal'],
  },
  {
    stage: 'meta_analysis',
    supportKeywords: ['low heterogeneity', 'robust', 'I² = 12%'],
    opposeKeywords: ['publication bias', 'Egger', 'high heterogeneity'],
  },
  {
    stage: 'bayesian',
    supportKeywords: ['strong', 'BF₁₀ = 14', 'robust to prior', 'convergence'],
    opposeKeywords: ['prior-sensitive', 'insufficient', 'weak evidence'],
  },
  {
    stage: 'adversarial',
    supportKeywords: ['no overclaiming', 'robust', '1 alternative'],
    opposeKeywords: ['OVERCLAIM', 'weaknesses identified', 'exceeds evidential warrant'],
  },
];

function determinePosition(
  detail: string,
  config: VoteConfig,
): 'supports' | 'opposes' | 'neutral' {
  const supportsCount = config.supportKeywords.filter((k) =>
    detail.toLowerCase().includes(k.toLowerCase()),
  ).length;
  const opposesCount = config.opposeKeywords.filter((k) =>
    detail.toLowerCase().includes(k.toLowerCase()),
  ).length;

  if (supportsCount > opposesCount) return 'supports';
  if (opposesCount > supportsCount) return 'opposes';
  return 'neutral';
}

function generateReasoning(stage: PipelineStage, position: string, detail: string): string {
  const stageNames: Record<string, string> = {
    statistical: 'Statistical engine',
    causal: 'Causal inference engine',
    meta_analysis: 'Meta-analytical engine',
    bayesian: 'Bayesian updating engine',
    adversarial: 'Adversarial review engine',
  };
  const name = stageNames[stage] ?? stage;

  if (position === 'supports') {
    return `${name} supports the conclusion based on: ${detail.slice(0, 80)}`;
  }
  if (position === 'opposes') {
    return `${name} raises concerns: ${detail.slice(0, 80)}`;
  }
  return `${name} is neutral — insufficient evidence to commit either way.`;
}

export function generateArbitration(stageResults: StageResult[]): ArbitrationResult {
  const votes: EngineVote[] = [];

  for (const config of VOTE_CONFIGS) {
    const stageData = stageResults.find((s) => s.stage === config.stage);
    if (!stageData || stageData.status === 'idle') continue;

    const detail = stageData.detail ?? stageData.summary;
    const position = determinePosition(detail, config);
    const confidence = position === 'supports' ? 0.7 + Math.random() * 0.25
      : position === 'opposes' ? 0.3 + Math.random() * 0.3
      : 0.45 + Math.random() * 0.15;

    votes.push({
      engine: config.stage,
      position,
      reasoning: generateReasoning(config.stage, position, detail),
      confidence: Math.round(confidence * 100) / 100,
    });
  }

  const supporters = votes.filter((v) => v.position === 'supports');
  const opposers = votes.filter((v) => v.position === 'opposes');

  const disagreements: string[] = [];
  if (opposers.length > 0) {
    for (const opp of opposers) {
      const supporter = supporters[0];
      if (supporter) {
        disagreements.push(
          `${opp.engine} opposes while ${supporter.engine} supports — ` +
          `${opp.reasoning.slice(opp.reasoning.indexOf(':') + 2, 100)}`
        );
      }
    }
  }

  const consensus = opposers.length === 0 || supporters.length >= opposers.length * 2;

  const resolution = consensus
    ? `Majority of engines (${supporters.length}/${votes.length}) support the conclusion. ${
        opposers.length > 0 ? 'Dissenting concerns noted but outweighed by converging evidence.' : 'Full consensus achieved.'
      }`
    : `Split decision: ${supporters.length} support, ${opposers.length} oppose, ${
        votes.length - supporters.length - opposers.length
      } neutral. Conclusion presented with elevated uncertainty.`;

  return { consensus, votes, disagreements, resolution };
}
