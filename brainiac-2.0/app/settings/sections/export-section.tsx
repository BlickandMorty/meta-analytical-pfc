'use client';

import { useState, useCallback } from 'react';
import {
  CheckCircle2Icon,
  DownloadIcon,
  FileJsonIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  ActivityIcon,
  MessageSquareIcon,
  BrainIcon,
  NetworkIcon,
  PackageIcon,
  BookOpenIcon,
} from 'lucide-react';

import { usePFCStore } from '@/lib/store/use-pfc-store';
import { exportData, downloadExport, getMimeType } from '@/lib/research/export';
import type { ExportFormat, ExportDataType } from '@/lib/research/types';
import { Badge } from '@/components/ui/badge';
import { GlassBubbleButton } from '@/components/chat/glass-bubble-button';
import { GlassSection } from '@/components/layout/page-shell';

export function ExportSection() {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('json');
  const [selectedData, setSelectedData] = useState<ExportDataType>('all');
  const [exported, setExported] = useState(false);

  const signals = usePFCStore((s) => s.signalHistory);
  const papers = usePFCStore((s) => s.researchPapers);
  const messages = usePFCStore((s) => s.messages);
  const cortexArchive = usePFCStore((s) => s.cortexArchive);

  const handleExport = useCallback(() => {
    const content = exportData(selectedFormat, selectedData, {
      signals,
      papers,
      chatHistory: messages,
      cortexSnapshots: cortexArchive,
    });
    const ext =
      selectedFormat === 'bibtex' ? 'bib' :
      selectedFormat === 'ris' ? 'ris' :
      selectedFormat;
    downloadExport(
      content,
      `pfc-export-${selectedData}-${new Date().toISOString().slice(0, 10)}.${ext}`,
      getMimeType(selectedFormat),
    );
    setExported(true);
    setTimeout(() => setExported(false), 2000);
  }, [selectedFormat, selectedData, signals, papers, messages, cortexArchive]);

  return (
    <GlassSection title="Export Data">
      <p className="text-sm text-muted-foreground/60 mb-4" style={{ fontFamily: 'var(--font-secondary)', fontWeight: 400 }}>
        Export raw data, signals, research papers, and analysis results.
      </p>

      {/* Data count badges */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        <Badge variant="secondary" className="text-[10px] bg-pfc-green/10 text-pfc-green border-0">
          {signals.length} signals
        </Badge>
        <Badge variant="secondary" className="text-[10px] bg-pfc-violet/10 text-pfc-violet border-0">
          {papers.length} papers
        </Badge>
        <Badge variant="secondary" className="text-[10px] bg-pfc-ember/10 text-pfc-ember border-0">
          {messages.length} messages
        </Badge>
        <Badge variant="secondary" className="text-[10px] bg-pfc-cyan/10 text-pfc-cyan border-0">
          {cortexArchive.length} snapshots
        </Badge>
      </div>

      {/* What to export */}
      <div className="mb-5">
        <label className="text-xs font-semibold text-muted-foreground mb-2 block">What to Export</label>
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: 'all' as ExportDataType, label: 'Everything', icon: PackageIcon },
            { value: 'signals' as ExportDataType, label: 'Signals', icon: ActivityIcon },
            { value: 'papers' as ExportDataType, label: 'Papers', icon: BookOpenIcon },
            { value: 'chat-history' as ExportDataType, label: 'Chat', icon: MessageSquareIcon },
            { value: 'pipeline-runs' as ExportDataType, label: 'Pipeline', icon: NetworkIcon },
            { value: 'thought-graphs' as ExportDataType, label: 'Thoughts', icon: BrainIcon },
          ]).map((opt) => {
            const Icon = opt.icon;
            return (
              <GlassBubbleButton
                key={opt.value}
                onClick={() => setSelectedData(opt.value)}
                active={selectedData === opt.value}
                color="violet"
                size="sm"
                fullWidth
                className="flex-col"
              >
                <Icon style={{ height: 14, width: 14 }} />
                <span style={{ fontFamily: 'var(--font-secondary)', fontSize: '0.5rem', fontWeight: 500 }}>{opt.label}</span>
              </GlassBubbleButton>
            );
          })}
        </div>
      </div>

      {/* Format */}
      <div className="mb-5">
        <label className="text-xs font-semibold text-muted-foreground mb-2 block">Format</label>
        <div className="grid grid-cols-5 gap-2">
          {([
            { value: 'json' as ExportFormat, label: 'JSON', icon: FileJsonIcon },
            { value: 'csv' as ExportFormat, label: 'CSV', icon: FileSpreadsheetIcon },
            { value: 'markdown' as ExportFormat, label: 'MD', icon: FileTextIcon },
            { value: 'bibtex' as ExportFormat, label: 'BibTeX', icon: BookOpenIcon },
            { value: 'ris' as ExportFormat, label: 'RIS', icon: BookOpenIcon },
          ]).map((opt) => {
            const Icon = opt.icon;
            const disabled = (opt.value === 'bibtex' || opt.value === 'ris') && selectedData !== 'papers' && selectedData !== 'all';
            return (
              <GlassBubbleButton
                key={opt.value}
                onClick={() => !disabled && setSelectedFormat(opt.value)}
                active={selectedFormat === opt.value}
                color="cyan"
                size="sm"
                fullWidth
                className="flex-col"
                disabled={disabled}
              >
                <Icon style={{ height: 14, width: 14 }} />
                <span style={{ fontFamily: 'var(--font-secondary)', fontSize: '0.5rem', fontWeight: 500 }}>{opt.label}</span>
              </GlassBubbleButton>
            );
          })}
        </div>
      </div>

      {/* Export button */}
      <GlassBubbleButton onClick={handleExport} color="ember" size="lg" fullWidth>
        {exported ? (
          <><CheckCircle2Icon className="h-4 w-4" /> Exported!</>
        ) : (
          <><DownloadIcon className="h-4 w-4" /> Export as {selectedFormat.toUpperCase()}</>
        )}
      </GlassBubbleButton>
    </GlassSection>
  );
}
