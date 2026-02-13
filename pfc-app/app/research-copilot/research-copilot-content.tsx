'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FlaskConicalIcon,
  SearchIcon,
  SparklesIcon,
  FileTextIcon,
  BookOpenIcon,
  LightbulbIcon,
  ShieldCheckIcon,
  ClipboardCopyIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ExternalLinkIcon,
  ZapIcon,
  StarIcon,
  AlertTriangleIcon,
  Loader2Icon,
  BookmarkPlusIcon,
  LibraryIcon,
  Trash2Icon,
  TagIcon,
  StickyNoteIcon,
  DownloadIcon,
  FilterIcon,
  UploadIcon,
} from 'lucide-react';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { useIsDark } from '@/hooks/use-is-dark';
import { useSetupGuard } from '@/hooks/use-setup-guard';
import { PageShell, Section } from '@/components/page-shell';
import { GlassBubbleButton } from '@/components/glass-bubble-button';
import { PixelBook } from '@/components/pixel-book';
import type { InferenceConfig } from '@/lib/engine/llm/config';
import type { S2Paper } from '@/lib/engine/research/semantic-scholar';
import { exportData, downloadExport, getMimeType } from '@/lib/research/export';
import type { ResearchPaper, ExportFormat } from '@/lib/research/types';

/* ═══════════════════════════════════════════════════════════════════
   API Response Interfaces
   ═══════════════════════════════════════════════════════════════════ */

interface NoveltyCheckResult {
  isNovel?: boolean;
  confidence?: number;
  summary?: string;
  rounds?: unknown[];
  totalPapersReviewed?: number;
  closestPapers?: S2Paper[];
}

interface PaperReviewResult {
  averagedScores?: Record<string, number>;
  scores?: Record<string, number>;
  decision?: string;
  consensusDecision?: string;
  individualReviews?: unknown[];
  agreementLevel?: number;
  metaReview?: string;
  summary?: string;
  strengths?: string[];
  weaknesses?: string[];
}

/* ═══════════════════════════════════════════════════════════════════
   Design Tokens
   ═══════════════════════════════════════════════════════════════════ */

const SPRING_SOFT = { type: 'spring' as const, stiffness: 300, damping: 25, mass: 0.6 };
const CUP = 'cubic-bezier(0.32, 0.72, 0, 1)';

/* ═══════════════════════════════════════════════════════════════════
   Tabs
   ═══════════════════════════════════════════════════════════════════ */

type HubTab = 'search' | 'novelty' | 'review' | 'citations' | 'ideas' | 'library';

const HUB_TABS: { key: HubTab; label: string; icon: React.ReactNode }[] = [
  { key: 'search', label: 'Paper Search', icon: <SearchIcon style={{ height: '0.8rem', width: '0.8rem' }} /> },
  { key: 'novelty', label: 'Novelty Check', icon: <SparklesIcon style={{ height: '0.8rem', width: '0.8rem' }} /> },
  { key: 'review', label: 'Paper Review', icon: <FileTextIcon style={{ height: '0.8rem', width: '0.8rem' }} /> },
  { key: 'citations', label: 'Citation Search', icon: <BookOpenIcon style={{ height: '0.8rem', width: '0.8rem' }} /> },
  { key: 'ideas', label: 'Idea Generator', icon: <LightbulbIcon style={{ height: '0.8rem', width: '0.8rem' }} /> },
  { key: 'library', label: 'Library', icon: <LibraryIcon style={{ height: '0.8rem', width: '0.8rem' }} /> },
];

/* ═══════════════════════════════════════════════════════════════════
   GlassInput — shared input component
   ═══════════════════════════════════════════════════════════════════ */

function GlassInput({
  value,
  onChange,
  placeholder,
  isDark,
  multiline,
  rows,
  maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  isDark: boolean;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
}) {
  const shared: React.CSSProperties = {
    width: '100%',
    padding: '0.625rem 1rem',
    borderRadius: multiline ? '0.75rem' : '9999px',
    fontSize: '0.8125rem',
    border: `1px solid ${isDark ? 'rgba(79,69,57,0.25)' : 'rgba(190,183,170,0.3)'}`,
    background: isDark ? 'rgba(22,21,19,0.5)' : 'rgba(255,255,255,0.5)',
    color: isDark ? 'rgba(237,224,212,1)' : 'rgba(60,45,30,0.85)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    outline: 'none',
    transition: `border 0.15s ${CUP}`,
    resize: multiline ? ('vertical' as const) : ('none' as const),
  };

  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows ?? 4}
        maxLength={maxLength ?? 50000}
        style={shared}
      />
    );
  }
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength ?? 10000}
      style={shared}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Score Ring — compact animated score display
   ═══════════════════════════════════════════════════════════════════ */

function ScoreRing({ score, max, label, isDark, size = 48 }: {
  score: number; max: number; label: string; isDark: boolean; size?: number;
}) {
  const pct = Math.min(score / max, 1);
  const r = (size - 6) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct);
  const color = pct >= 0.75 ? '#34D399' : pct >= 0.5 ? '#FBBF24' : pct >= 0.25 ? '#FB923C' : '#F87171';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={isDark ? 'rgba(79,69,57,0.3)' : 'rgba(190,183,170,0.3)'}
            strokeWidth={3} />
          <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={color} strokeWidth={3} strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
            style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }} />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.75rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color,
        }}>
          {score.toFixed(1)}
        </div>
      </div>
      <span style={{
        fontSize: '0.5625rem', fontWeight: 500, letterSpacing: '-0.01em',
        color: isDark ? 'rgba(156,143,128,0.7)' : 'rgba(0,0,0,0.4)',
      }}>{label}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Paper Card — compact display for search results
   ═══════════════════════════════════════════════════════════════════ */

function PaperCard({ paper, isDark, onSave }: {
  paper: S2Paper; isDark: boolean; onSave: (paper: S2Paper) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hovered, setHovered] = useState(false);
  const authors = paper.authors.slice(0, 3).map((a) => a.name).join(', ');
  const extra = paper.authors.length > 3 ? ` +${paper.authors.length - 3}` : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING_SOFT}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: '0.75rem',
        padding: '0.875rem 1rem',
        border: `1px solid ${hovered ? (isDark ? 'rgba(79,69,57,0.3)' : 'rgba(190,183,170,0.3)') : 'transparent'}`,
        background: hovered
          ? (isDark ? 'rgba(55,50,45,0.35)' : 'rgba(0,0,0,0.04)')
          : (isDark ? 'rgba(244,189,111,0.03)' : 'rgba(0,0,0,0.02)'),
        transition: `background 0.15s ${CUP}, border 0.15s ${CUP}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.35, cursor: 'pointer',
              letterSpacing: '-0.01em',
            }}
            onClick={() => setExpanded(!expanded)}
          >
            {paper.title}
          </div>
          <div style={{
            fontSize: '0.6875rem', marginTop: '0.25rem',
            color: isDark ? 'rgba(156,143,128,0.7)' : 'rgba(0,0,0,0.4)',
          }}>
            {authors}{extra} · {paper.year ?? 'n.d.'} · {paper.citationCount} citations
            {paper.venue && ` · ${paper.venue}`}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
          {paper.url && (
            <a href={paper.url} target="_blank" rel="noopener noreferrer"
              style={{ padding: '0.375rem', borderRadius: '0.5rem', color: isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.3)' }}>
              <ExternalLinkIcon style={{ height: '0.875rem', width: '0.875rem' }} />
            </a>
          )}
          <button
            onClick={() => { onSave(paper); setSaved(true); setTimeout(() => setSaved(false), 2000); }}
            style={{
              padding: '0.375rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer',
              background: 'transparent',
              color: saved ? '#34D399' : (isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.3)'),
            }}
          >
            {saved ? <CheckIcon style={{ height: '0.875rem', width: '0.875rem' }} /> : <BookmarkPlusIcon style={{ height: '0.875rem', width: '0.875rem' }} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && paper.abstract && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              marginTop: '0.75rem', paddingTop: '0.625rem',
              borderTop: `1px solid ${isDark ? 'rgba(79,69,57,0.2)' : 'rgba(0,0,0,0.06)'}`,
              fontSize: '0.75rem', lineHeight: 1.6,
              color: isDark ? 'rgba(156,143,128,0.8)' : 'rgba(0,0,0,0.55)',
            }}>
              {paper.abstract}
            </div>
            {paper.tldr?.text && (
              <div style={{
                marginTop: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
                background: isDark ? 'rgba(var(--pfc-accent-rgb), 0.08)' : 'rgba(var(--pfc-accent-rgb), 0.06)',
                fontSize: '0.6875rem', lineHeight: 1.5,
                color: isDark ? 'rgba(var(--pfc-accent-rgb), 0.9)' : 'rgba(139,100,50,0.8)',
              }}>
                <strong>TL;DR:</strong> {paper.tldr.text}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */

function useInferenceConfig(): InferenceConfig | null {
  const mode = usePFCStore((s) => s.inferenceMode);
  const apiProvider = usePFCStore((s) => s.apiProvider);
  const apiKey = usePFCStore((s) => s.apiKey);
  const openaiModel = usePFCStore((s) => s.openaiModel);
  const anthropicModel = usePFCStore((s) => s.anthropicModel);
  const ollamaBaseUrl = usePFCStore((s) => s.ollamaBaseUrl);
  const ollamaModel = usePFCStore((s) => s.ollamaModel);

  if (mode === 'simulation') return null;
  return { mode, apiProvider, apiKey, openaiModel, anthropicModel, ollamaBaseUrl, ollamaModel };
}

async function researchFetch<T>(
  action: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(`/api/research/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `Research API error: ${res.status}`);
  }
  return res.json();
}

/* ═══════════════════════════════════════════════════════════════════
   Tab: Paper Search
   ═══════════════════════════════════════════════════════════════════ */

function PaperSearchTab({ isDark }: { isDark: boolean }) {
  const [query, setQuery] = useState('');
  const [year, setYear] = useState('');
  const [results, setResults] = useState<S2Paper[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const addPaper = usePFCStore((s) => s.addResearchPaper);
  const abortRef = useRef<AbortController | null>(null);

  // Cleanup on unmount — cancel any in-flight fetch
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true); setError('');
    try {
      const data = await researchFetch<{ total: number; data: S2Paper[] }>('search-papers', {
        query: query.trim(), limit: 15, year: year || undefined,
      }, controller.signal);
      if (!controller.signal.aborted) { setResults(data.data); setTotal(data.total); }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(e instanceof Error ? e.message : 'Search failed');
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, [query, year]);

  const handleSave = useCallback((paper: S2Paper) => {
    addPaper({
      id: `s2-${paper.paperId}`,
      title: paper.title,
      authors: paper.authors.map((a) => a.name),
      year: paper.year ?? new Date().getFullYear(),
      journal: paper.venue || undefined,
      doi: paper.externalIds?.DOI,
      url: paper.url,
      abstract: paper.abstract ?? undefined,
      tags: ['semantic-scholar'],
      savedAt: Date.now(),
    });
  }, [addPaper]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <GlassInput value={query} onChange={setQuery} placeholder="Search papers on Semantic Scholar..." isDark={isDark} />
        </div>
        <div style={{ width: '8rem' }}>
          <GlassInput value={year} onChange={setYear} placeholder="Year range" isDark={isDark} />
        </div>
        <GlassBubbleButton color="ember" onClick={search} disabled={loading || !query.trim()}>
          {loading ? <Loader2Icon style={{ height: '0.875rem', width: '0.875rem', animation: 'spin 1s linear infinite' }} /> : <SearchIcon style={{ height: '0.875rem', width: '0.875rem' }} />}
          Search
        </GlassBubbleButton>
      </div>

      {error && (
        <div style={{
          padding: '0.75rem 1rem', borderRadius: '0.75rem',
          background: isDark ? 'rgba(248,113,113,0.08)' : 'rgba(248,113,113,0.06)',
          color: '#F87171', fontSize: '0.75rem',
        }}>
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div style={{ fontSize: '0.6875rem', color: isDark ? 'rgba(156,143,128,0.6)' : 'rgba(0,0,0,0.35)' }}>
          {total.toLocaleString()} results found
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        {results.map((paper) => (
          <PaperCard key={paper.paperId} paper={paper} isDark={isDark} onSave={handleSave} />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Tab: Novelty Check
   ═══════════════════════════════════════════════════════════════════ */

function NoveltyCheckTab({ isDark }: { isDark: boolean }) {
  const inferenceConfig = useInferenceConfig();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [result, setResult] = useState<NoveltyCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const runCheck = useCallback(async () => {
    if (!title.trim() || !description.trim()) return;
    if (!inferenceConfig) { setError('Switch to API or Local mode in Settings to use this tool'); return; }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true); setError('');
    try {
      const data = await researchFetch<NoveltyCheckResult>('check-novelty', {
        title: title.trim(), description: description.trim(),
        maxRounds: 3, inferenceConfig,
      }, controller.signal);
      if (!controller.signal.aborted) setResult(data);
    } catch (e) { if ((e as Error).name !== 'AbortError') setError(e instanceof Error ? e.message : 'Novelty check failed'); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [title, description, inferenceConfig]);

  const isNovel = result?.isNovel;
  const confidence = result?.confidence;
  const summary = result?.summary;
  const rounds = result?.rounds;
  const totalPapersReviewed = result?.totalPapersReviewed;
  const closestPapers = result?.closestPapers;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {!inferenceConfig && (
        <div style={{
          padding: '0.75rem 1rem', borderRadius: '0.75rem',
          background: isDark ? 'rgba(251,191,36,0.08)' : 'rgba(251,191,36,0.06)',
          color: '#FBBF24', fontSize: '0.75rem',
        }}>
          <AlertTriangleIcon style={{ height: '0.75rem', width: '0.75rem', display: 'inline', marginRight: '0.375rem' }} />
          LLM required — switch to API or Local mode in Settings
        </div>
      )}
      <GlassInput value={title} onChange={setTitle} placeholder="Idea title..." isDark={isDark} />
      <GlassInput value={description} onChange={setDescription} placeholder="Describe your research idea..." isDark={isDark} multiline rows={4} />
      <GlassBubbleButton color="green" onClick={runCheck} disabled={loading || !title.trim() || !description.trim() || !inferenceConfig}>
        {loading ? <Loader2Icon style={{ height: '0.875rem', width: '0.875rem', animation: 'spin 1s linear infinite' }} /> : <ShieldCheckIcon style={{ height: '0.875rem', width: '0.875rem' }} />}
        {loading ? 'Checking...' : 'Check Novelty'}
      </GlassBubbleButton>

      {error && (
        <div style={{
          padding: '0.75rem 1rem', borderRadius: '0.75rem',
          background: isDark ? 'rgba(248,113,113,0.08)' : 'rgba(248,113,113,0.06)',
          color: '#F87171', fontSize: '0.75rem',
        }}>{error}</div>
      )}

      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING_SOFT}>
          {/* Verdict */}
          <div style={{
            padding: '1rem', borderRadius: '0.75rem', marginBottom: '0.75rem',
            background: isNovel
              ? (isDark ? 'rgba(52,211,153,0.08)' : 'rgba(52,211,153,0.06)')
              : (isDark ? 'rgba(248,113,113,0.08)' : 'rgba(248,113,113,0.06)'),
            border: `1px solid ${isNovel ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                fontSize: '1.5rem', fontWeight: 800,
                color: isNovel ? '#34D399' : '#F87171',
              }}>
                {isNovel ? 'Novel' : 'Not Novel'}
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: isDark ? 'rgba(156,143,128,0.8)' : 'rgba(0,0,0,0.5)',
              }}>
                {confidence != null ? `${Math.round(confidence * 100)}%` : '—'} confidence · {rounds?.length ?? 0} search rounds · {totalPapersReviewed ?? 0} papers reviewed
              </div>
            </div>
            {summary && (
              <div style={{
                marginTop: '0.5rem', fontSize: '0.75rem', lineHeight: 1.6,
                color: isDark ? 'rgba(156,143,128,0.8)' : 'rgba(0,0,0,0.5)',
              }}>
                {summary}
              </div>
            )}
          </div>

          {/* Closest papers */}
          {closestPapers && closestPapers.length > 0 && (
            <Section title="Closest Existing Papers">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {closestPapers.map((p) => (
                  <div key={p.paperId} style={{
                    padding: '0.625rem 0.875rem', borderRadius: '0.5rem',
                    background: isDark ? 'rgba(244,189,111,0.03)' : 'rgba(0,0,0,0.02)',
                    fontSize: '0.75rem',
                  }}>
                    <div style={{ fontWeight: 600 }}>{p.title}</div>
                    <div style={{
                      fontSize: '0.6875rem', marginTop: '0.125rem',
                      color: isDark ? 'rgba(156,143,128,0.6)' : 'rgba(0,0,0,0.35)',
                    }}>
                      {p.authors?.slice(0, 3).map((a) => a.name).join(', ')} · {p.year ?? 'n.d.'} · {p.citationCount} citations
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </motion.div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Tab: Paper Review
   ═══════════════════════════════════════════════════════════════════ */

function PaperReviewTab({ isDark }: { isDark: boolean }) {
  const inferenceConfig = useInferenceConfig();
  const [title, setTitle] = useState('');
  const [abstract, setAbstract] = useState('');
  const [fullText, setFullText] = useState('');
  const [useEnsemble, setUseEnsemble] = useState(false);
  const [result, setResult] = useState<PaperReviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const runReview = useCallback(async () => {
    if (!title.trim() || !abstract.trim()) return;
    if (!inferenceConfig) { setError('Switch to API or Local mode in Settings'); return; }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true); setError('');
    try {
      const action = useEnsemble ? 'ensemble-review' : 'review-paper';
      const data = await researchFetch<PaperReviewResult>(action, {
        title: title.trim(), abstract: abstract.trim(),
        fullText: fullText.trim() || undefined,
        numReviewers: 3, inferenceConfig,
      }, controller.signal);
      if (!controller.signal.aborted) setResult(data);
    } catch (e) { if ((e as Error).name !== 'AbortError') setError(e instanceof Error ? e.message : 'Review failed'); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [title, abstract, fullText, useEnsemble, inferenceConfig]);

  // Extract typed fields
  const scores = result?.averagedScores ?? result?.scores;
  const decision = result?.decision ?? result?.consensusDecision;
  const isAccept = decision === 'accept';
  const isEnsemble = Boolean(result?.individualReviews);
  const agreementLevel = result?.agreementLevel;
  const reviewerCount = result?.individualReviews?.length;
  const reviewSummary = result?.metaReview ?? result?.summary;
  const strengths = result?.strengths;
  const weaknesses = result?.weaknesses;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {!inferenceConfig && (
        <div style={{
          padding: '0.75rem 1rem', borderRadius: '0.75rem',
          background: isDark ? 'rgba(251,191,36,0.08)' : 'rgba(251,191,36,0.06)',
          color: '#FBBF24', fontSize: '0.75rem',
        }}>
          <AlertTriangleIcon style={{ height: '0.75rem', width: '0.75rem', display: 'inline', marginRight: '0.375rem' }} />
          LLM required — switch to API or Local mode in Settings
        </div>
      )}
      <GlassInput value={title} onChange={setTitle} placeholder="Paper title..." isDark={isDark} />
      <GlassInput value={abstract} onChange={setAbstract} placeholder="Paper abstract..." isDark={isDark} multiline rows={4} />
      <GlassInput value={fullText} onChange={setFullText} placeholder="Full text (optional, improves review quality)..." isDark={isDark} multiline rows={6} />

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <GlassBubbleButton color="violet" onClick={runReview} disabled={loading || !title.trim() || !abstract.trim() || !inferenceConfig}>
          {loading ? <Loader2Icon style={{ height: '0.875rem', width: '0.875rem', animation: 'spin 1s linear infinite' }} /> : <FileTextIcon style={{ height: '0.875rem', width: '0.875rem' }} />}
          {loading ? 'Reviewing...' : 'Review Paper'}
        </GlassBubbleButton>
        <GlassBubbleButton
          color={useEnsemble ? 'green' : 'neutral'}
          active={useEnsemble}
          onClick={() => setUseEnsemble(!useEnsemble)}
        >
          <ZapIcon style={{ height: '0.75rem', width: '0.75rem' }} />
          Ensemble (3 reviewers)
        </GlassBubbleButton>
      </div>

      {error && (
        <div style={{
          padding: '0.75rem 1rem', borderRadius: '0.75rem',
          background: isDark ? 'rgba(248,113,113,0.08)' : 'rgba(248,113,113,0.06)',
          color: '#F87171', fontSize: '0.75rem',
        }}>{error}</div>
      )}

      {scores && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING_SOFT}
          style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Decision */}
          <div style={{
            padding: '0.875rem 1rem', borderRadius: '0.75rem',
            background: isAccept
              ? (isDark ? 'rgba(52,211,153,0.08)' : 'rgba(52,211,153,0.06)')
              : (isDark ? 'rgba(248,113,113,0.08)' : 'rgba(248,113,113,0.06)'),
            border: `1px solid ${isAccept ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'}`,
            display: 'flex', alignItems: 'center', gap: '0.75rem',
          }}>
            <span style={{
              fontSize: '1.25rem', fontWeight: 800,
              color: isAccept ? '#34D399' : '#F87171',
            }}>
              {(decision ?? '').toUpperCase()}
            </span>
            {isEnsemble && (
              <span style={{ fontSize: '0.6875rem', color: isDark ? 'rgba(156,143,128,0.6)' : 'rgba(0,0,0,0.35)' }}>
                {agreementLevel != null ? `${Math.round(agreementLevel * 100)}%` : '—'} agreement · {reviewerCount ?? 0} reviewers
              </span>
            )}
          </div>

          {/* Scores ring grid */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center' }}>
            <ScoreRing score={scores.overall ?? 0} max={10} label="Overall" isDark={isDark} size={56} />
            <ScoreRing score={scores.originality ?? 0} max={4} label="Originality" isDark={isDark} />
            <ScoreRing score={scores.quality ?? 0} max={4} label="Quality" isDark={isDark} />
            <ScoreRing score={scores.clarity ?? 0} max={4} label="Clarity" isDark={isDark} />
            <ScoreRing score={scores.significance ?? 0} max={4} label="Significance" isDark={isDark} />
            <ScoreRing score={scores.soundness ?? 0} max={4} label="Soundness" isDark={isDark} />
            <ScoreRing score={scores.presentation ?? 0} max={4} label="Presentation" isDark={isDark} />
            <ScoreRing score={scores.contribution ?? 0} max={4} label="Contribution" isDark={isDark} />
            <ScoreRing score={scores.confidence ?? 0} max={5} label="Confidence" isDark={isDark} />
          </div>

          {/* Summary + feedback */}
          {reviewSummary && (
            <Section title={isEnsemble ? 'Meta-Review' : 'Summary'}>
              <div style={{
                fontSize: '0.75rem', lineHeight: 1.7,
                color: isDark ? 'rgba(156,143,128,0.85)' : 'rgba(0,0,0,0.55)',
              }}>
                {reviewSummary}
              </div>
            </Section>
          )}

          {/* Strengths / Weaknesses */}
          {((strengths && strengths.length > 0) || (weaknesses && weaknesses.length > 0)) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {strengths && strengths.length > 0 && (
                <Section title="Strengths">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    {strengths.map((s, i) => (
                      <div key={i} style={{
                        fontSize: '0.6875rem', lineHeight: 1.5, display: 'flex', gap: '0.5rem',
                        color: isDark ? 'rgba(156,143,128,0.8)' : 'rgba(0,0,0,0.5)',
                      }}>
                        <span style={{ color: '#34D399', fontWeight: 700, flexShrink: 0 }}>+</span>
                        {s}
                      </div>
                    ))}
                  </div>
                </Section>
              )}
              {weaknesses && weaknesses.length > 0 && (
                <Section title="Weaknesses">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    {weaknesses.map((w, i) => (
                      <div key={i} style={{
                        fontSize: '0.6875rem', lineHeight: 1.5, display: 'flex', gap: '0.5rem',
                        color: isDark ? 'rgba(156,143,128,0.8)' : 'rgba(0,0,0,0.5)',
                      }}>
                        <span style={{ color: '#F87171', fontWeight: 700, flexShrink: 0 }}>-</span>
                        {w}
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Tab: Citation Search
   ═══════════════════════════════════════════════════════════════════ */

function CitationSearchTab({ isDark }: { isDark: boolean }) {
  const inferenceConfig = useInferenceConfig();
  const [text, setText] = useState('');
  const [context, setContext] = useState('');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const runSearch = useCallback(async () => {
    if (!text.trim()) return;
    if (!inferenceConfig) { setError('Switch to API or Local mode in Settings'); return; }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true); setError('');
    try {
      const data = await researchFetch<Record<string, unknown>>('search-citations', {
        text: text.trim(), context: context.trim() || undefined,
        maxRounds: 2, inferenceConfig,
      }, controller.signal);
      if (!controller.signal.aborted) setResult(data);
    } catch (e) { if ((e as Error).name !== 'AbortError') setError(e instanceof Error ? e.message : 'Citation search failed'); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [text, context, inferenceConfig]);

  const annotatedText = result?.annotatedText as string | undefined;
  const bibtexEntries = result?.bibtexEntries as string[] | undefined;
  const totalClaimsFound = result?.totalClaimsFound as number | undefined;
  const totalPapersMatched = result?.totalPapersMatched as number | undefined;
  const allMatches = result?.allMatches as Record<string, unknown>[] | undefined;

  const copyAnnotated = useCallback(() => {
    if (!annotatedText) return;
    navigator.clipboard.writeText(annotatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [annotatedText]);

  const copyBibtex = useCallback(() => {
    if (!bibtexEntries?.length) return;
    navigator.clipboard.writeText(bibtexEntries.join('\n\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [bibtexEntries]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {!inferenceConfig && (
        <div style={{
          padding: '0.75rem 1rem', borderRadius: '0.75rem',
          background: isDark ? 'rgba(251,191,36,0.08)' : 'rgba(251,191,36,0.06)',
          color: '#FBBF24', fontSize: '0.75rem',
        }}>
          <AlertTriangleIcon style={{ height: '0.75rem', width: '0.75rem', display: 'inline', marginRight: '0.375rem' }} />
          LLM required — switch to API or Local mode in Settings
        </div>
      )}
      <GlassInput value={text} onChange={setText} placeholder="Paste your research text to find citations..." isDark={isDark} multiline rows={8} />
      <GlassInput value={context} onChange={setContext} placeholder="Topic context (optional, e.g. 'transformer architectures')..." isDark={isDark} />
      <GlassBubbleButton color="cyan" onClick={runSearch} disabled={loading || !text.trim() || !inferenceConfig}>
        {loading ? <Loader2Icon style={{ height: '0.875rem', width: '0.875rem', animation: 'spin 1s linear infinite' }} /> : <BookOpenIcon style={{ height: '0.875rem', width: '0.875rem' }} />}
        {loading ? 'Searching citations...' : 'Find Citations'}
      </GlassBubbleButton>

      {error && (
        <div style={{
          padding: '0.75rem 1rem', borderRadius: '0.75rem',
          background: isDark ? 'rgba(248,113,113,0.08)' : 'rgba(248,113,113,0.06)',
          color: '#F87171', fontSize: '0.75rem',
        }}>{error}</div>
      )}

      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING_SOFT}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Stats */}
          <div style={{
            display: 'flex', gap: '1.5rem', fontSize: '0.75rem',
            color: isDark ? 'rgba(156,143,128,0.7)' : 'rgba(0,0,0,0.4)',
          }}>
            <span>{totalClaimsFound ?? 0} claims identified</span>
            <span>{totalPapersMatched ?? 0} papers matched</span>
            <span>{bibtexEntries?.length ?? 0} unique references</span>
          </div>

          {/* Copy buttons */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <GlassBubbleButton color="ember" size="sm" onClick={copyAnnotated}>
              <ClipboardCopyIcon style={{ height: '0.75rem', width: '0.75rem' }} />
              Copy Annotated Text
            </GlassBubbleButton>
            <GlassBubbleButton color="neutral" size="sm" onClick={copyBibtex}>
              <ClipboardCopyIcon style={{ height: '0.75rem', width: '0.75rem' }} />
              Copy BibTeX
            </GlassBubbleButton>
            {copied && (
              <span style={{ fontSize: '0.6875rem', color: '#34D399', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <CheckIcon style={{ height: '0.75rem', width: '0.75rem' }} /> Copied!
              </span>
            )}
          </div>

          {/* Citation matches */}
          {allMatches && allMatches.length > 0 && (
            <Section title="Citation Matches">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {allMatches.map((m, i) => {
                  const paper = m.paper as Record<string, unknown> | undefined;
                  const claim = m.claim as string | undefined;
                  const bibtexKey = m.bibtexKey as string | undefined;
                  const explanation = m.explanation as string | undefined;
                  const relevanceScore = m.relevanceScore as number | undefined;

                  return (
                    <div key={i} style={{
                      padding: '0.75rem', borderRadius: '0.625rem',
                      background: isDark ? 'rgba(244,189,111,0.03)' : 'rgba(0,0,0,0.02)',
                      fontSize: '0.75rem',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: '0.6875rem', fontStyle: 'italic', marginBottom: '0.25rem',
                            color: isDark ? 'rgba(var(--pfc-accent-rgb), 0.8)' : 'rgba(139,100,50,0.7)',
                          }}>
                            &ldquo;{claim}&rdquo;
                          </div>
                          <div style={{ fontWeight: 600 }}>
                            {(paper?.title as string) ?? 'Unknown'}{' '}
                            <span style={{
                              fontWeight: 400,
                              color: isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.3)',
                            }}>[{bibtexKey}]</span>
                          </div>
                          {explanation && (
                            <div style={{
                              fontSize: '0.6875rem', marginTop: '0.125rem',
                              color: isDark ? 'rgba(156,143,128,0.6)' : 'rgba(0,0,0,0.35)',
                            }}>
                              {explanation}
                            </div>
                          )}
                        </div>
                        {relevanceScore != null && (
                          <div style={{
                            fontSize: '0.6875rem', fontWeight: 700, flexShrink: 0,
                            color: relevanceScore >= 0.8 ? '#34D399' : relevanceScore >= 0.6 ? '#FBBF24' : '#FB923C',
                          }}>
                            {Math.round(relevanceScore * 100)}%
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}
        </motion.div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Tab: Idea Generator
   ═══════════════════════════════════════════════════════════════════ */

function IdeaGeneratorTab({ isDark }: { isDark: boolean }) {
  const inferenceConfig = useInferenceConfig();
  const [topic, setTopic] = useState('');
  const [context, setContext] = useState('');
  const [constraints, setConstraints] = useState('');
  const [numIdeas, setNumIdeas] = useState(3);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedIdea, setExpandedIdea] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const generate = useCallback(async () => {
    if (!topic.trim()) return;
    if (!inferenceConfig) { setError('Switch to API or Local mode in Settings'); return; }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true); setError('');
    try {
      const data = await researchFetch<Record<string, unknown>>('generate-ideas', {
        topic: topic.trim(),
        context: context.trim() || undefined,
        constraints: constraints.trim() || undefined,
        numIdeas, numReflections: 2, inferenceConfig,
      }, controller.signal);
      if (!controller.signal.aborted) setResult(data);
    } catch (e) { if ((e as Error).name !== 'AbortError') setError(e instanceof Error ? e.message : 'Idea generation failed'); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [topic, context, constraints, numIdeas, inferenceConfig]);

  const quickIdea = useCallback(async () => {
    if (!topic.trim()) return;
    if (!inferenceConfig) { setError('Switch to API or Local mode in Settings'); return; }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true); setError('');
    try {
      const idea = await researchFetch<Record<string, unknown>>('quick-idea', {
        topic: topic.trim(), context: context.trim() || undefined, inferenceConfig,
      }, controller.signal);
      if (!controller.signal.aborted) {
        setResult({
          ideas: [{ idea, reflectionRounds: [], overallScore: 0, generationTimestamp: Date.now() }],
          totalGenerated: 1, totalAfterDedup: 1, topic: topic.trim(),
        });
      }
    } catch (e) { if ((e as Error).name !== 'AbortError') setError(e instanceof Error ? e.message : 'Quick idea failed'); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [topic, context, inferenceConfig]);

  const ideas = result?.ideas as Record<string, unknown>[] | undefined;
  const totalGenerated = result?.totalGenerated as number | undefined;
  const totalAfterDedup = result?.totalAfterDedup as number | undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {!inferenceConfig && (
        <div style={{
          padding: '0.75rem 1rem', borderRadius: '0.75rem',
          background: isDark ? 'rgba(251,191,36,0.08)' : 'rgba(251,191,36,0.06)',
          color: '#FBBF24', fontSize: '0.75rem',
        }}>
          <AlertTriangleIcon style={{ height: '0.75rem', width: '0.75rem', display: 'inline', marginRight: '0.375rem' }} />
          LLM required — switch to API or Local mode in Settings
        </div>
      )}
      <GlassInput value={topic} onChange={setTopic} placeholder="Research topic (e.g., 'attention mechanisms in vision transformers')..." isDark={isDark} />
      <GlassInput value={context} onChange={setContext} placeholder="Additional context (optional)..." isDark={isDark} />
      <GlassInput value={constraints} onChange={setConstraints} placeholder="Constraints (optional, e.g., 'must use public datasets')..." isDark={isDark} />

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <GlassBubbleButton color="yellow" onClick={generate} disabled={loading || !topic.trim() || !inferenceConfig}>
          {loading ? <Loader2Icon style={{ height: '0.875rem', width: '0.875rem', animation: 'spin 1s linear infinite' }} /> : <LightbulbIcon style={{ height: '0.875rem', width: '0.875rem' }} />}
          {loading ? 'Generating...' : `Generate ${numIdeas} Ideas`}
        </GlassBubbleButton>
        <GlassBubbleButton color="neutral" onClick={quickIdea} disabled={loading || !topic.trim() || !inferenceConfig}>
          <ZapIcon style={{ height: '0.75rem', width: '0.75rem' }} />
          Quick Idea
        </GlassBubbleButton>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          {[1, 2, 3, 5].map((n) => (
            <GlassBubbleButton key={n} size="sm" active={numIdeas === n}
              color={numIdeas === n ? 'ember' : 'neutral'}
              onClick={() => setNumIdeas(n)}>
              {n}
            </GlassBubbleButton>
          ))}
        </div>
      </div>

      {error && (
        <div style={{
          padding: '0.75rem 1rem', borderRadius: '0.75rem',
          background: isDark ? 'rgba(248,113,113,0.08)' : 'rgba(248,113,113,0.06)',
          color: '#F87171', fontSize: '0.75rem',
        }}>{error}</div>
      )}

      {ideas && ideas.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING_SOFT}
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

          <div style={{ fontSize: '0.6875rem', color: isDark ? 'rgba(156,143,128,0.6)' : 'rgba(0,0,0,0.35)' }}>
            Generated {totalGenerated ?? 0} ideas · {totalAfterDedup ?? 0} after dedup
          </div>

          {ideas.map((gi, idx) => {
            const idea = gi.idea as Record<string, string> | undefined;
            const overallScore = gi.overallScore as number | undefined;
            const reflectionRounds = gi.reflectionRounds as Record<string, unknown>[] | undefined;
            const isExpanded = expandedIdea === idx;

            if (!idea) return null;

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...SPRING_SOFT, delay: idx * 0.08 }}
                style={{
                  borderRadius: '0.75rem', padding: '1rem',
                  background: isDark ? 'rgba(244,189,111,0.04)' : 'rgba(0,0,0,0.02)',
                  border: `1px solid ${isDark ? 'rgba(79,69,57,0.15)' : 'rgba(190,183,170,0.2)'}`,
                }}
              >
                <div
                  style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}
                  onClick={() => setExpandedIdea(isExpanded ? null : idx)}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{
                        fontSize: '0.6875rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                        color: (overallScore ?? 0) >= 0.7 ? '#34D399' : (overallScore ?? 0) >= 0.4 ? '#FBBF24' : '#F87171',
                      }}>
                        {Math.round((overallScore ?? 0) * 100)}%
                      </span>
                      <StarIcon style={{
                        height: '0.6875rem', width: '0.6875rem',
                        color: (overallScore ?? 0) >= 0.7 ? '#34D399' : (overallScore ?? 0) >= 0.4 ? '#FBBF24' : (isDark ? 'rgba(156,143,128,0.3)' : 'rgba(0,0,0,0.15)'),
                      }} />
                    </div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 650, lineHeight: 1.35, letterSpacing: '-0.01em' }}>
                      {idea.title}
                    </div>
                    <div style={{
                      fontSize: '0.6875rem', marginTop: '0.25rem',
                      color: isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.3)',
                      fontFamily: 'monospace',
                    }}>
                      {idea.name}
                    </div>
                  </div>
                  {isExpanded
                    ? <ChevronUpIcon style={{ height: '1rem', width: '1rem', flexShrink: 0, color: isDark ? 'rgba(156,143,128,0.4)' : 'rgba(0,0,0,0.2)' }} />
                    : <ChevronDownIcon style={{ height: '1rem', width: '1rem', flexShrink: 0, color: isDark ? 'rgba(156,143,128,0.4)' : 'rgba(0,0,0,0.2)' }} />
                  }
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{
                        marginTop: '0.75rem', paddingTop: '0.75rem',
                        borderTop: `1px solid ${isDark ? 'rgba(79,69,57,0.2)' : 'rgba(0,0,0,0.06)'}`,
                        display: 'flex', flexDirection: 'column', gap: '0.75rem',
                        fontSize: '0.75rem', lineHeight: 1.6,
                        color: isDark ? 'rgba(156,143,128,0.8)' : 'rgba(0,0,0,0.55)',
                      }}>
                        {(['experiment', 'interestingness', 'feasibility', 'novelty'] as const).map((field) => (
                          <div key={field}>
                            <div style={{
                              fontWeight: 600, fontSize: '0.6875rem', marginBottom: '0.25rem',
                              textTransform: 'uppercase', letterSpacing: '0.05em',
                              color: isDark ? 'rgba(var(--pfc-accent-rgb), 0.7)' : 'rgba(139,100,50,0.6)',
                            }}>
                              {field.charAt(0).toUpperCase() + field.slice(1)}
                            </div>
                            {idea[field]}
                          </div>
                        ))}
                        {reflectionRounds && reflectionRounds.length > 0 && (
                          <div style={{
                            paddingTop: '0.5rem',
                            borderTop: `1px solid ${isDark ? 'rgba(79,69,57,0.15)' : 'rgba(0,0,0,0.04)'}`,
                          }}>
                            <div style={{
                              fontWeight: 600, fontSize: '0.6875rem', marginBottom: '0.375rem',
                              textTransform: 'uppercase', letterSpacing: '0.05em',
                              color: isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.3)',
                            }}>
                              Reflection ({reflectionRounds.length} rounds)
                            </div>
                            {reflectionRounds.map((rr, ri) => {
                              const critique = rr.critique as string | undefined;
                              const improvements = rr.improvements as string[] | undefined;
                              const roundNumber = rr.roundNumber as number | undefined;
                              return (
                                <div key={ri} style={{
                                  marginBottom: '0.375rem', paddingLeft: '0.625rem',
                                  borderLeft: `2px solid ${isDark ? 'rgba(79,69,57,0.2)' : 'rgba(0,0,0,0.06)'}`,
                                  fontSize: '0.6875rem',
                                }}>
                                  <strong>Round {roundNumber ?? ri + 1}:</strong> {(critique ?? '').slice(0, 200)}
                                  {improvements && improvements.length > 0 && (
                                    <div style={{ marginTop: '0.125rem', color: isDark ? 'rgba(52,211,153,0.7)' : 'rgba(22,101,52,0.6)' }}>
                                      Improvements: {improvements.join('; ')}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Tab: Library — saved papers, search, export
   ═══════════════════════════════════════════════════════════════════ */

function LibraryTab({ isDark }: { isDark: boolean }) {
  const papers = usePFCStore((s) => s.researchPapers);
  const addResearchPaper = usePFCStore((s) => s.addResearchPaper);
  const removeResearchPaper = usePFCStore((s) => s.removeResearchPaper);
  const updateResearchPaper = usePFCStore((s) => s.updateResearchPaper);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      const name = file.name.replace(/\.(pdf|bib|ris|txt)$/i, '').replace(/[-_]/g, ' ');
      const paper: ResearchPaper = {
        id: `paper-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: name,
        authors: [],
        year: new Date().getFullYear(),
        tags: ['imported'],
        savedAt: Date.now(),
      };
      addResearchPaper(paper);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [addResearchPaper]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    papers.forEach((p) => p.tags.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [papers]);

  const filteredPapers = useMemo(() => {
    let result = papers;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.authors.some((a) => a.toLowerCase().includes(q)) ||
          p.journal?.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    if (selectedTag) {
      result = result.filter((p) => p.tags.includes(selectedTag));
    }
    return result;
  }, [papers, searchQuery, selectedTag]);

  const handleExport = useCallback(
    (format: ExportFormat) => {
      const content = exportData(format, 'papers', { papers });
      const ext = format === 'bibtex' ? 'bib' : format;
      downloadExport(content, `pfc-research-library.${ext}`, getMimeType(format));
    },
    [papers],
  );

  const handleSaveNote = useCallback(
    (id: string) => {
      updateResearchPaper(id, { notes: noteText });
      setEditingId(null);
      setNoteText('');
    },
    [noteText, updateResearchPaper],
  );

  const tagPillStyle = (isActive: boolean): React.CSSProperties => ({
    fontSize: '0.75rem',
    padding: '0.125rem 0.5rem',
    borderRadius: '9999px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    border: isActive
      ? `1px solid ${isDark ? 'rgba(var(--pfc-accent-rgb), 0.2)' : 'rgba(var(--pfc-accent-rgb), 0.15)'}`
      : '1px solid transparent',
    background: isActive
      ? (isDark ? 'rgba(44,43,41,0.85)' : 'rgba(255,255,255,0.85)')
      : (isDark ? 'rgba(244,189,111,0.05)' : 'rgba(0,0,0,0.03)'),
    color: isActive
      ? (isDark ? 'rgba(232,228,222,0.95)' : 'rgba(60,45,30,0.85)')
      : (isDark ? 'rgba(156,143,128,0.7)' : 'rgba(0,0,0,0.45)'),
    boxShadow: isActive
      ? (isDark ? '0 2px 8px -1px rgba(0,0,0,0.3), 0 1px 3px -1px rgba(0,0,0,0.2)' : '0 2px 16px -2px rgba(0,0,0,0.06), 0 1px 4px -1px rgba(0,0,0,0.04)')
      : 'none',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Search + Import */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <GlassInput value={searchQuery} onChange={setSearchQuery} placeholder="Search papers, authors, tags..." isDark={isDark} />
        </div>
        <input ref={fileInputRef} type="file" accept=".pdf,.bib,.ris,.txt" multiple onChange={handleFileImport} style={{ display: 'none' }} />
        <GlassBubbleButton size="sm" color="green" onClick={() => fileInputRef.current?.click()}>
          <UploadIcon style={{ height: '0.875rem', width: '0.875rem' }} />
          Import
        </GlassBubbleButton>
      </div>

      {/* Tag Filter */}
      {allTags.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
          <FilterIcon style={{ height: '0.75rem', width: '0.75rem', color: isDark ? 'rgba(156,143,128,0.4)' : 'rgba(0,0,0,0.2)' }} />
          <button onClick={() => setSelectedTag(null)} style={tagPillStyle(!selectedTag)}>All</button>
          {allTags.map((tag) => (
            <button key={tag} onClick={() => setSelectedTag(selectedTag === tag ? null : tag)} style={tagPillStyle(selectedTag === tag)}>
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Export row */}
      {papers.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
          <DownloadIcon style={{ height: '0.75rem', width: '0.75rem', color: isDark ? 'rgba(156,143,128,0.4)' : 'rgba(0,0,0,0.2)' }} />
          <span style={{ fontSize: '0.6875rem', color: isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.3)' }}>Export:</span>
          {(['json', 'csv', 'markdown', 'bibtex', 'ris'] as ExportFormat[]).map((fmt) => (
            <button
              key={fmt}
              onClick={() => handleExport(fmt)}
              style={{
                fontSize: '0.6875rem', padding: '0.125rem 0.5rem', borderRadius: '9999px',
                cursor: 'pointer', fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
                transition: 'all 0.15s ease', border: '1px solid transparent',
                background: isDark ? 'rgba(244,189,111,0.05)' : 'rgba(0,0,0,0.03)',
                color: isDark ? 'rgba(156,143,128,0.7)' : 'rgba(0,0,0,0.45)',
              }}
            >
              {fmt}
            </button>
          ))}
        </div>
      )}

      {/* Paper count */}
      <div style={{ fontSize: '0.6875rem', color: isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.3)' }}>
        {filteredPapers.length} papers{papers.length !== filteredPapers.length ? ` (${papers.length} total)` : ''}
      </div>

      {/* Papers list */}
      {filteredPapers.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '3rem 0',
          color: isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.3)', fontSize: '0.8125rem',
        }}>
          <BookOpenIcon style={{ height: '2.5rem', width: '2.5rem', margin: '0 auto 0.75rem', opacity: 0.15 }} />
          {papers.length === 0
            ? 'No papers saved yet. Search for papers above or import files.'
            : 'No papers match your search.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filteredPapers.map((paper) => (
            <motion.div
              key={paper.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={SPRING_SOFT}
              style={{
                borderRadius: '0.75rem', padding: '0.875rem 1rem',
                border: `1px solid transparent`,
                background: isDark ? 'rgba(244,189,111,0.03)' : 'rgba(0,0,0,0.02)',
                transition: `background 0.15s ${CUP}, border 0.15s ${CUP}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isDark ? 'rgba(55,50,45,0.35)' : 'rgba(0,0,0,0.04)';
                e.currentTarget.style.borderColor = isDark ? 'rgba(79,69,57,0.3)' : 'rgba(190,183,170,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isDark ? 'rgba(244,189,111,0.03)' : 'rgba(0,0,0,0.02)';
                e.currentTarget.style.borderColor = 'transparent';
              }}
            >
              {/* Title row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.35, letterSpacing: '-0.01em' }}>
                    {paper.title}
                  </div>
                  <div style={{
                    fontSize: '0.6875rem', marginTop: '0.25rem',
                    color: isDark ? 'rgba(156,143,128,0.7)' : 'rgba(0,0,0,0.4)',
                  }}>
                    {paper.authors.join(', ')} ({paper.year})
                    {paper.journal && ` · ${paper.journal}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.125rem', flexShrink: 0 }}>
                  {paper.url && (
                    <a href={paper.url} target="_blank" rel="noopener noreferrer"
                      style={{ padding: '0.375rem', borderRadius: '0.5rem', color: isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.3)' }}>
                      <ExternalLinkIcon style={{ height: '0.875rem', width: '0.875rem' }} />
                    </a>
                  )}
                  <button
                    onClick={() => {
                      if (editingId === paper.id) { setEditingId(null); }
                      else { setEditingId(paper.id); setNoteText(paper.notes ?? ''); }
                    }}
                    style={{
                      padding: '0.375rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer',
                      background: 'transparent', color: isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.3)',
                    }}
                  >
                    <StickyNoteIcon style={{ height: '0.875rem', width: '0.875rem' }} />
                  </button>
                  <button
                    onClick={() => removeResearchPaper(paper.id)}
                    style={{
                      padding: '0.375rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer',
                      background: 'transparent', color: isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.3)',
                    }}
                  >
                    <Trash2Icon style={{ height: '0.875rem', width: '0.875rem' }} />
                  </button>
                </div>
              </div>

              {/* Abstract */}
              {paper.abstract && (
                <div style={{
                  fontSize: '0.6875rem', lineHeight: 1.5, marginTop: '0.375rem',
                  color: isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.3)',
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {paper.abstract}
                </div>
              )}

              {/* Tags */}
              {paper.tags.length > 0 && (
                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginTop: '0.375rem' }}>
                  {paper.doi && (
                    <span style={{
                      fontSize: '0.625rem', padding: '0.0625rem 0.375rem', borderRadius: '9999px',
                      fontFamily: 'var(--font-mono)',
                      background: isDark ? 'rgba(139,124,246,0.1)' : 'rgba(139,124,246,0.08)',
                      color: isDark ? 'rgba(139,124,246,0.8)' : 'rgba(100,80,200,0.7)',
                    }}>
                      DOI: {paper.doi}
                    </span>
                  )}
                  {paper.tags.map((tag) => (
                    <span key={tag} style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.1875rem',
                      fontSize: '0.625rem', padding: '0.0625rem 0.375rem', borderRadius: '9999px',
                      background: isDark ? 'rgba(52,211,153,0.1)' : 'rgba(52,211,153,0.08)',
                      color: isDark ? 'rgba(52,211,153,0.8)' : 'rgba(22,101,52,0.7)',
                    }}>
                      <TagIcon style={{ height: '0.5rem', width: '0.5rem' }} />
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Saved note display */}
              {paper.notes && editingId !== paper.id && (
                <div style={{
                  marginTop: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
                  background: isDark ? 'rgba(244,189,111,0.05)' : 'rgba(244,189,111,0.04)',
                  border: `1px solid ${isDark ? 'rgba(244,189,111,0.1)' : 'rgba(244,189,111,0.08)'}`,
                  fontSize: '0.6875rem', lineHeight: 1.5,
                  color: isDark ? 'rgba(244,189,111,0.7)' : 'rgba(139,100,50,0.6)',
                }}>
                  {paper.notes}
                </div>
              )}

              {/* Note editing */}
              <AnimatePresence>
                {editingId === paper.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ overflow: 'hidden', marginTop: '0.5rem' }}
                  >
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Add notes..."
                      rows={2}
                      maxLength={5000}
                      style={{
                        width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
                        border: `1px solid ${isDark ? 'rgba(79,69,57,0.25)' : 'rgba(190,183,170,0.3)'}`,
                        background: isDark ? 'rgba(22,21,19,0.5)' : 'rgba(255,255,255,0.5)',
                        color: isDark ? 'rgba(237,224,212,1)' : 'rgba(60,45,30,0.85)',
                        fontSize: '0.75rem', outline: 'none', resize: 'vertical',
                        marginBottom: '0.375rem',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      <GlassBubbleButton size="sm" color="ember" onClick={() => handleSaveNote(paper.id)}>Save Note</GlassBubbleButton>
                      <GlassBubbleButton size="sm" color="neutral" onClick={() => setEditingId(null)}>Cancel</GlassBubbleButton>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════════════════ */

export default function ResearchHubPage() {
  const ready = useSetupGuard();
  const { isDark } = useIsDark();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as HubTab) || 'search';
  const [activeTab, setActiveTab] = useState<HubTab>(
    HUB_TABS.some((t) => t.key === initialTab) ? initialTab : 'search',
  );

  if (!ready) {
    return (
      <div style={{
        display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center',
        background: 'var(--chat-surface)',
      }}>
        <PixelBook size={40} />
      </div>
    );
  }

  return (
    <PageShell
      icon={FlaskConicalIcon}
      iconColor="var(--color-pfc-ember)"
      title="Research Hub"
      subtitle="AI-powered paper search, review, novelty checking, citation finding, and idea generation"
      backHref="/library?tab=tools"
    >
      {/* ── Tab Switcher (scrollable pill row) ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.25rem',
          borderRadius: '9999px',
          background: isDark ? 'rgba(22,21,19,0.65)' : 'rgba(237,232,222,0.6)',
          border: `1px solid ${isDark ? 'rgba(50,49,45,0.25)' : 'rgba(190,183,170,0.3)'}`,
          backdropFilter: 'blur(20px) saturate(1.5)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
          overflowX: 'auto',
          scrollbarWidth: 'none' as const,
        }}
      >
        {HUB_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: '0 0 auto',
              padding: '0.4375rem 0.875rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: activeTab === tab.key ? 600 : 500,
              cursor: 'pointer',
              border: activeTab === tab.key
                ? `1px solid ${isDark ? 'rgba(var(--pfc-accent-rgb), 0.2)' : 'rgba(var(--pfc-accent-rgb), 0.15)'}`
                : '1px solid transparent',
              background: activeTab === tab.key
                ? (isDark ? 'rgba(44,43,41,0.85)' : 'rgba(255,255,255,0.85)')
                : 'transparent',
              color: activeTab === tab.key
                ? (isDark ? 'rgba(232,228,222,0.95)' : 'rgba(60,45,30,0.85)')
                : (isDark ? 'rgba(156,143,128,0.7)' : 'rgba(0,0,0,0.45)'),
              boxShadow: activeTab === tab.key
                ? (isDark ? '0 2px 8px -1px rgba(0,0,0,0.3), 0 1px 3px -1px rgba(0,0,0,0.2)' : '0 2px 16px -2px rgba(0,0,0,0.06), 0 1px 4px -1px rgba(0,0,0,0.04)')
                : 'none',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'search' && <PaperSearchTab isDark={isDark} />}
          {activeTab === 'novelty' && <NoveltyCheckTab isDark={isDark} />}
          {activeTab === 'review' && <PaperReviewTab isDark={isDark} />}
          {activeTab === 'citations' && <CitationSearchTab isDark={isDark} />}
          {activeTab === 'ideas' && <IdeaGeneratorTab isDark={isDark} />}
          {activeTab === 'library' && <LibraryTab isDark={isDark} />}
        </motion.div>
      </AnimatePresence>
    </PageShell>
  );
}
