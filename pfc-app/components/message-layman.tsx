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
  const activeSections = SECTION_KEYS
    .map((key) => ({
      key,
      text: layman[key],
      label: layman.sectionLabels?.[key] ?? DEFAULT_LABELS[key],
    }))
    .filter((s) => s.text);

  // Single section (trivial query or note) — render as clean paragraph
  if (activeSections.length <= 1) {
    const section = activeSections[0];
    if (!section) return null;
    return (
      <p className="text-[13.5px] leading-[1.7] text-foreground/90">
        {section.text}
      </p>
    );
  }

  // Multiple sections — render with subtle left accent borders, no numbered circles
  return (
    <div className="space-y-3">
      {activeSections.map((section) => (
        <div
          key={section.key}
          className="border-l-2 border-pfc-ember/15 pl-3"
        >
          <p className="text-[9.5px] font-medium text-muted-foreground/50 tracking-wide mb-0.5">
            {section.label}
          </p>
          <p className="text-[13.5px] leading-[1.65] text-foreground/90">
            {section.text}
          </p>
        </div>
      ))}
    </div>
  );
}
