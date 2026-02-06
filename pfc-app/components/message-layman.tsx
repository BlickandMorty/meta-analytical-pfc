'use client';

import type { LaymanSummary } from '@/lib/engine/types';
import { cn } from '@/lib/utils';

const DEFAULT_LABELS: Record<string, string> = {
  whatWasTried: 'What was tried',
  whatIsLikelyTrue: 'What is likely true',
  confidenceExplanation: 'Confidence',
  whatCouldChange: 'What could change',
  whoShouldTrust: 'Who should trust this',
};

const SECTION_KEYS = [
  'whatWasTried',
  'whatIsLikelyTrue',
  'confidenceExplanation',
  'whatCouldChange',
  'whoShouldTrust',
] as const;

interface MessageLaymanProps {
  layman: LaymanSummary;
}

export function MessageLayman({ layman }: MessageLaymanProps) {
  // Filter to only sections that have content, then assign sequential icons
  const activeSections = SECTION_KEYS
    .map((key) => ({
      key,
      text: layman[key],
      label: layman.sectionLabels?.[key] ?? DEFAULT_LABELS[key],
    }))
    .filter((s) => s.text);

  return (
    <div className="space-y-3.5">
      {activeSections.map((section, idx) => (
        <div key={section.key} className="flex gap-3">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pfc-ember/10 text-pfc-ember text-[10px] font-semibold mt-[3px]">
            {idx + 1}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-0.5">
              {section.label}
            </p>
            <p className="text-[13.5px] leading-[1.65] text-foreground/90">
              {section.text}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
