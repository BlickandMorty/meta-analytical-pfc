'use client';

import { useState, memo } from 'react';
import type { TruthAssessment } from '@/lib/engine/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ShieldCheckIcon, ChevronDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TruthBotCardProps {
  assessment: TruthAssessment;
}

function TruthBotCardBase({ assessment }: TruthBotCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const truthPct = Math.round(assessment.overallTruthLikelihood * 100);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <Card className="border-pfc-cyan/20 hover:border-pfc-cyan/40 transition-colors cursor-pointer" style={{ fontFamily: 'var(--font-sans)' }}>
          <CardHeader className="p-3 pb-0">
            <CardTitle className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheckIcon className="h-3.5 w-3.5 text-pfc-cyan" />
                <span className="font-medium text-muted-foreground" style={{ fontFamily: 'var(--font-sans)' }}>Truth Assessment</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'text-sm font-bold',
                    truthPct > 60 ? 'text-pfc-green' : truthPct > 35 ? 'text-pfc-yellow' : 'text-pfc-red'
                  )}
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {truthPct}%
                </span>
                <ChevronDownIcon className={cn('h-3 w-3 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
              </div>
            </CardTitle>
          </CardHeader>
        </Card>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <Card className="border-pfc-cyan/20 mt-1 border-t-0 rounded-t-none" style={{ fontFamily: 'var(--font-sans)' }}>
          <CardContent className="p-3 space-y-3">
            {/* Signal Interpretation */}
            <Section title="Signal Interpretation" content={assessment.signalInterpretation} />

            {/* Weaknesses */}
            <Section title="Weaknesses">
              <ul className="space-y-1">
                {assessment.weaknesses.map((w, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                    <span className="text-pfc-red shrink-0">•</span>
                    {w}
                  </li>
                ))}
              </ul>
            </Section>

            {/* Blind Spots */}
            <Section title="Blind Spots">
              <ul className="space-y-1">
                {assessment.blindSpots.map((b, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                    <span className="text-pfc-yellow shrink-0">•</span>
                    {b}
                  </li>
                ))}
              </ul>
            </Section>

            {/* Recommended Actions */}
            <Section title="Recommended Actions">
              <ul className="space-y-1">
                {assessment.recommendedActions.map((a, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                    <span className="text-pfc-green shrink-0">→</span>
                    {a}
                  </li>
                ))}
              </ul>
            </Section>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}

function Section({ title, content, children }: { title: string; content?: string; children?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 mb-1" style={{ fontFamily: 'var(--font-sans)' }}>{title}</p>
      {content ? <p className="text-xs text-foreground/80 leading-[1.7] break-words" style={{ fontFamily: 'var(--font-sans)' }}>{content}</p> : children}
    </div>
  );
}

export const TruthBotCard = memo(TruthBotCardBase);
