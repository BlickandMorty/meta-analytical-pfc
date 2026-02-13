'use client';

import { useState, useCallback } from 'react';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { useSetupGuard } from '@/hooks/use-setup-guard';
import { PageShell, GlassSection } from '@/components/page-shell';
import { PixelBook } from '@/components/pixel-book';
import { GlassBubbleButton } from '@/components/glass-bubble-button';
import { Badge } from '@/components/ui/badge';
import {
  DownloadIcon,
  FileJsonIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  BookOpenIcon,
  ActivityIcon,
  MessageSquareIcon,
  BrainIcon,
  NetworkIcon,
  CheckCircle2Icon,
  PackageIcon,
} from 'lucide-react';
import { exportData, downloadExport, getMimeType } from '@/lib/research/export';
import type { ExportFormat, ExportDataType } from '@/lib/research/types';

const FORMAT_OPTIONS: { value: ExportFormat; label: string; icon: typeof FileJsonIcon; desc: string }[] = [
  { value: 'json', label: 'JSON', icon: FileJsonIcon, desc: 'Structured data, full fidelity' },
  { value: 'csv', label: 'CSV', icon: FileSpreadsheetIcon, desc: 'Tabular data for spreadsheets' },
  { value: 'markdown', label: 'Markdown', icon: FileTextIcon, desc: 'Readable report format' },
  { value: 'bibtex', label: 'BibTeX', icon: BookOpenIcon, desc: 'LaTeX citation format' },
  { value: 'ris', label: 'RIS', icon: BookOpenIcon, desc: 'Reference manager import' },
];

const DATA_OPTIONS: { value: ExportDataType; label: string; icon: typeof ActivityIcon; desc: string }[] = [
  { value: 'all', label: 'Everything', icon: PackageIcon, desc: 'Full export of all data' },
  { value: 'signals', label: 'Signals', icon: ActivityIcon, desc: 'Confidence, entropy, dissonance history' },
  { value: 'papers', label: 'Research Papers', icon: BookOpenIcon, desc: 'Saved paper library' },
  { value: 'chat-history', label: 'Chat History', icon: MessageSquareIcon, desc: 'All messages and analyses' },
  { value: 'pipeline-runs', label: 'Pipeline Runs', icon: NetworkIcon, desc: 'Cortex snapshots and brain states' },
  { value: 'thought-graphs', label: 'Thought Graphs', icon: BrainIcon, desc: 'Visualization data' },
];

export default function ExportPage() {
  const ready = useSetupGuard();
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

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--chat-surface)]">
        <PixelBook size={40} />
      </div>
    );
  }

  return (
    <PageShell
      icon={DownloadIcon}
      iconColor="var(--color-pfc-cyan)"
      title="Export Data"
      subtitle="Export raw data, signals, research papers, and analysis results"
    >
      <div className="space-y-6">
        {/* Data counts */}
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="secondary" className="text-[10px] bg-pfc-green/10 text-pfc-green border-0">
            {signals.length} signal entries
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

        {/* Data Type Selection */}
        <GlassSection title="What to Export">
          <div className="grid grid-cols-2 gap-3">
            {DATA_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isActive = selectedData === opt.value;
              return (
                <GlassBubbleButton
                  key={opt.value}
                  onClick={() => setSelectedData(opt.value)}
                  active={isActive}
                  color="violet"
                  fullWidth
                  style={{
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    textAlign: 'left',
                    borderRadius: '1rem',
                    paddingTop: '0.75rem',
                    paddingBottom: '0.75rem',
                    paddingLeft: '1rem',
                    paddingRight: '1rem',
                  }}
                >
                  <div className="flex items-center gap-2 w-full">
                    <Icon style={{ height: 14, width: 14, flexShrink: 0, color: isActive ? 'var(--pfc-accent)' : 'inherit', transition: 'color 0.15s' }} />
                    <span style={{ fontSize: '0.625rem', fontWeight: 400, fontFamily: 'var(--font-heading)' }}>{opt.label}</span>
                  </div>
                  <span style={{ fontSize: '0.5625rem', opacity: 0.5, fontWeight: 400, whiteSpace: 'normal', lineHeight: 1.4, marginTop: '0.125rem' }}>{opt.desc}</span>
                </GlassBubbleButton>
              );
            })}
          </div>
        </GlassSection>

        {/* Format Selection */}
        <GlassSection title="Export Format">
          <div className="grid grid-cols-3 gap-3">
            {FORMAT_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isActive = selectedFormat === opt.value;
              // Disable BibTeX/RIS if not exporting papers
              const disabled = (opt.value === 'bibtex' || opt.value === 'ris') && selectedData !== 'papers' && selectedData !== 'all';
              return (
                <GlassBubbleButton
                  key={opt.value}
                  onClick={() => !disabled && setSelectedFormat(opt.value)}
                  active={isActive}
                  color="cyan"
                  fullWidth
                  style={{
                    flexDirection: 'column',
                    alignItems: 'center',
                    borderRadius: '1rem',
                    paddingTop: '0.75rem',
                    paddingBottom: '0.75rem',
                    paddingLeft: '0.75rem',
                    paddingRight: '0.75rem',
                  }}
                  disabled={disabled}
                >
                  <Icon style={{ height: 16, width: 16, color: isActive ? '#22D3EE' : 'inherit', transition: 'color 0.15s' }} />
                  <span style={{ fontSize: '0.625rem', fontWeight: 400, fontFamily: 'var(--font-heading)', marginTop: '0.25rem' }}>{opt.label}</span>
                  <span style={{ fontSize: '0.5rem', opacity: 0.5, fontWeight: 400, whiteSpace: 'normal', lineHeight: 1.3 }}>{opt.desc}</span>
                </GlassBubbleButton>
              );
            })}
          </div>
        </GlassSection>

        {/* Export Button */}
        <div className="pt-2">
          <GlassBubbleButton
            onClick={handleExport}
            color="ember"
            size="lg"
            fullWidth
          >
            {exported ? (
              <>
                <CheckCircle2Icon className="h-4 w-4" />
                Exported!
              </>
            ) : (
              <>
                <DownloadIcon className="h-4 w-4" />
                Export {selectedData === 'all' ? 'All Data' : DATA_OPTIONS.find((d) => d.value === selectedData)?.label} as {selectedFormat.toUpperCase()}
              </>
            )}
          </GlassBubbleButton>
        </div>

        {/* Usage info */}
        <div className="rounded-2xl border border-border/20 bg-muted/20 px-4 py-3 text-sm text-muted-foreground space-y-1">
          <p className="font-semibold text-xs">Third-Party Tool Compatibility</p>
          <ul className="list-disc list-inside space-y-0.5 text-xs text-muted-foreground/60">
            <li><strong>JSON:</strong> Import into Python, R, MATLAB, or any data analysis tool</li>
            <li><strong>CSV:</strong> Open in Excel, Google Sheets, SPSS, or Stata</li>
            <li><strong>Markdown:</strong> Use in Obsidian, Notion, or any markdown editor</li>
            <li><strong>BibTeX:</strong> Import into LaTeX, Overleaf, or Zotero</li>
            <li><strong>RIS:</strong> Import into EndNote, Mendeley, or Zotero</li>
          </ul>
        </div>
      </div>
    </PageShell>
  );
}
