'use client';

import { useEffect, useMemo, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LibraryIcon,
  BookOpenIcon,
  UsersIcon,
  QuoteIcon,
  SparklesIcon,
  SearchIcon,
  ExternalLinkIcon,
  TagIcon,
  CalendarIcon,
  FileTextIcon,
  LightbulbIcon,
  TrendingUpIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FlaskConicalIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  BrainIcon,
} from 'lucide-react';

import { usePFCStore } from '@/lib/store/use-pfc-store';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useSetupGuard } from '@/hooks/use-setup-guard';
import { PageShell, GlassSection } from '@/components/layout/page-shell';
import { PixelBook } from '@/components/pixel-book';
import { useIsDark } from '@/hooks/use-is-dark';
import type { ResearchPaper, Citation } from '@/lib/research/types';

// ── Types ────────────────────────────────────────────────────────

interface ExtractedAuthor {
  name: string;
  paperCount: number;
  years: number[];
  tags: string[];
}

interface ReadingSuggestion {
  title: string;
  reason: string;
  domain: string;
}

type LibraryTab = 'papers' | 'thinkers' | 'citations' | 'suggestions' | 'tools';

const TABS: { key: LibraryTab; label: string; icon: React.ElementType }[] = [
  { key: 'papers', label: 'Papers', icon: FileTextIcon },
  { key: 'thinkers', label: 'Thinkers & Authors', icon: UsersIcon },
  { key: 'citations', label: 'Citations', icon: QuoteIcon },
  { key: 'suggestions', label: 'Reading List', icon: LightbulbIcon },
  { key: 'tools', label: 'Research Tools', icon: FlaskConicalIcon },
];

// ── Helpers ──────────────────────────────────────────────────────

function extractAuthors(papers: ResearchPaper[]): ExtractedAuthor[] {
  const authorMap = new Map<string, ExtractedAuthor>();

  for (const paper of papers) {
    for (const author of paper.authors) {
      const key = author.toLowerCase().trim();
      if (key.length < 2) continue;
      const existing = authorMap.get(key);
      if (existing) {
        existing.paperCount++;
        if (paper.year && !existing.years.includes(paper.year)) {
          existing.years.push(paper.year);
        }
        for (const tag of paper.tags) {
          if (!existing.tags.includes(tag)) existing.tags.push(tag);
        }
      } else {
        authorMap.set(key, {
          name: author.trim(),
          paperCount: 1,
          years: paper.year ? [paper.year] : [],
          tags: [...paper.tags],
        });
      }
    }
  }

  return Array.from(authorMap.values()).sort((a, b) => b.paperCount - a.paperCount);
}

function generateSuggestions(papers: ResearchPaper[], concepts: string[]): ReadingSuggestion[] {
  const suggestions: ReadingSuggestion[] = [];
  const seen = new Set<string>();

  // From paper tags — suggest deeper reading
  const tagCounts = new Map<string, number>();
  for (const p of papers) {
    for (const tag of p.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  // Top 3 tags = top interests
  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  for (const [tag, count] of topTags) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push({
      title: `Deep dive into ${tag}`,
      reason: `You have ${count} paper${count > 1 ? 's' : ''} tagged with "${tag}" — consider reading foundational texts in this area`,
      domain: tag,
    });
  }

  // From active concepts — suggest cross-disciplinary reading
  for (const concept of concepts.slice(0, 4)) {
    const key = concept.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push({
      title: `Explore: ${concept.replace(/_/g, ' ')}`,
      reason: `This concept appeared in your research — finding primary sources would strengthen your understanding`,
      domain: concept.replace(/_/g, ' '),
    });
  }

  // Methodology suggestions based on paper types
  if (papers.length > 3 && !seen.has('methodology')) {
    suggestions.push({
      title: 'Research Methods & Methodology',
      reason: `With ${papers.length} papers in your library, understanding meta-analytical methods would help synthesize findings`,
      domain: 'methodology',
    });
  }

  return suggestions.slice(0, 8);
}

// ── Stat Card (flat oval / pill style) ───────────────────────────

function StatCard({ label, value, icon: Icon, color, isDark, isDefaultLight }: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  isDark: boolean;
  isDefaultLight?: boolean;
}) {
  // On default light mode, flatten all colors to neutral near-white gray
  const effectiveColor = isDefaultLight ? '#9E9E9E' : color;
  const pillBg = isDefaultLight ? '#F5F5F5' : isDark ? `${color}1A` : `${color}14`;
  const iconBg = isDefaultLight ? '#EEEEEE' : isDark ? `${color}20` : `${color}18`;

  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.625rem',
        padding: '0.625rem 1.25rem',
        borderRadius: '9999px',
        border: 'none',
        background: pillBg,
        cursor: 'default',
        boxShadow: isDefaultLight ? '0 1px 3px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)' : 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '1.75rem',
          height: '1.75rem',
          borderRadius: '0.5rem',
          background: iconBg,
        }}
      >
        <Icon style={{ width: '0.875rem', height: '0.875rem', color: effectiveColor }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.375rem' }}>
        <span style={{ fontSize: '1.0625rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: effectiveColor }}>{value}</span>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: effectiveColor, opacity: 0.7 }}>{label}</span>
      </div>
    </motion.div>
  );
}

// ── Paper Card ───────────────────────────────────────────────────

function PaperCard({ paper, isDark }: { paper: ResearchPaper; isDark: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      layout
      className={cn(
        'rounded-lg border p-4 transition-colors',
        isDark ? 'border-white/5 bg-white/[0.02]' : 'border-black/5 bg-black/[0.01]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <button
            className="text-left text-sm font-medium leading-snug hover:underline"
            onClick={() => setExpanded(!expanded)}
          >
            {paper.title}
            {expanded ? (
              <ChevronDownIcon className="inline h-3.5 w-3.5 ml-1 opacity-50" />
            ) : (
              <ChevronRightIcon className="inline h-3.5 w-3.5 ml-1 opacity-50" />
            )}
          </button>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
            {paper.authors.length > 0 && (
              <span>{paper.authors.slice(0, 3).join(', ')}{paper.authors.length > 3 ? ` +${paper.authors.length - 3}` : ''}</span>
            )}
            {paper.year > 0 && (
              <>
                <span className="opacity-30">·</span>
                <span className="flex items-center gap-0.5">
                  <CalendarIcon className="h-2.5 w-2.5" />
                  {paper.year}
                </span>
              </>
            )}
            {paper.journal && (
              <>
                <span className="opacity-30">·</span>
                <span className="italic truncate max-w-[140px]">{paper.journal}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {paper.url && (
            <a
              href={paper.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
            >
              <ExternalLinkIcon className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      {paper.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {paper.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-[9px] px-1.5 py-0">
              <TagIcon className="h-2 w-2 mr-0.5" />
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <AnimatePresence>
        {expanded && paper.abstract && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-3 text-xs text-muted-foreground leading-relaxed overflow-hidden"
          >
            {paper.abstract}
          </motion.div>
        )}
      </AnimatePresence>

      {paper.notes && (
        <div className="mt-2 text-[11px] italic text-muted-foreground/70 border-l-2 border-muted-foreground/10 pl-2">
          {paper.notes.length > 120 ? paper.notes.slice(0, 117) + '...' : paper.notes}
        </div>
      )}
    </motion.div>
  );
}

// ── Author Card ──────────────────────────────────────────────────

function AuthorCard({ author, isDark, isDefaultLight }: { author: ExtractedAuthor; isDark: boolean; isDefaultLight?: boolean }) {
  const yearRange = author.years.length > 0
    ? `${Math.min(...author.years)}–${Math.max(...author.years)}`
    : '';

  return (
    <div className={cn(
      'rounded-lg border p-3 flex items-center gap-3',
      isDark ? 'border-white/5 bg-white/[0.02]' : 'border-black/5 bg-black/[0.01]',
    )}>
      {/* Avatar placeholder */}
      <div
        className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
        style={{
          background: isDefaultLight ? '#EEEEEE' : isDark ? 'rgba(139,124,246,0.15)' : 'rgba(139,124,246,0.1)',
          color: isDefaultLight ? '#9E9E9E' : '#8B7CF6',
        }}
      >
        {author.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{author.name}</div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>{author.paperCount} paper{author.paperCount > 1 ? 's' : ''}</span>
          {yearRange && (
            <>
              <span className="opacity-30">·</span>
              <span>{yearRange}</span>
            </>
          )}
        </div>
      </div>
      {author.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 shrink-0 max-w-[120px]">
          {author.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="outline" className="text-[8px] px-1 py-0">{tag}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Research Tools Tab ────────────────────────────────────────────

const RESEARCH_TOOLS = [
  {
    key: 'search',
    label: 'Paper Search',
    description: 'Search millions of papers on Semantic Scholar. Find papers by topic, author, or keyword.',
    icon: SearchIcon,
    color: '#F59E0B',
    href: '/research-copilot?tab=search',
  },
  {
    key: 'novelty',
    label: 'Novelty Checker',
    description: 'Check if your research idea is novel by searching existing literature with AI-guided iterative refinement.',
    icon: ShieldCheckIcon,
    color: '#34D399',
    href: '/research-copilot?tab=novelty',
  },
  {
    key: 'review',
    label: 'Paper Review',
    description: 'Get AI-generated peer reviews with scores for originality, quality, clarity, and significance.',
    icon: FileTextIcon,
    color: '#8B7CF6',
    href: '/research-copilot?tab=review',
  },
  {
    key: 'citations',
    label: 'Citation Search',
    description: 'Paste your text and find supporting citations automatically. Generates annotated text and BibTeX.',
    icon: BookOpenIcon,
    color: '#22D3EE',
    href: '/research-copilot?tab=citations',
  },
  {
    key: 'ideas',
    label: 'Idea Generator',
    description: 'Generate and refine research ideas with multi-round reflection and scoring.',
    icon: LightbulbIcon,
    color: '#FBBF24',
    href: '/research-copilot?tab=ideas',
  },
  {
    key: 'concepts',
    label: 'Concept Atlas',
    description: 'Live force-directed concept mapping from your chat, notes, and research.',
    icon: BrainIcon,
    color: '#A78BFA',
    href: '/concept-atlas',
  },
] as const;

function ResearchToolsTab({ isDark, isDefaultLight }: { isDark: boolean; isDefaultLight?: boolean }) {
  const router = useRouter();
  return (
    <div className="space-y-3">
      <div className="text-[11px] text-muted-foreground mb-3 flex items-center gap-1">
        <FlaskConicalIcon className="h-3 w-3" />
        AI-powered research tools — click to open
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {RESEARCH_TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.key}
              onClick={() => router.push(tool.href)}
              className={cn(
                'rounded-lg border p-4 text-left transition-all hover:scale-[1.01]',
                isDark
                  ? 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10'
                  : 'border-black/5 bg-black/[0.01] hover:bg-black/[0.03] hover:border-black/10',
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className="rounded-md p-2 shrink-0"
                  style={{ background: isDefaultLight ? '#EEEEEE' : `${tool.color}15` }}
                >
                  <Icon className="h-4 w-4" style={{ color: isDefaultLight ? '#9E9E9E' : tool.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    {tool.label}
                    <ArrowRightIcon className="h-3 w-3 opacity-30" />
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    {tool.description}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ██ LIBRARY PAGE
// ═══════════════════════════════════════════════════════════════════

export default function LibraryPage() {
  return (
    <Suspense>
      <LibraryPageInner />
    </Suspense>
  );
}

const VALID_TABS: LibraryTab[] = ['papers', 'thinkers', 'citations', 'suggestions', 'tools'];

function LibraryPageInner() {
  const ready = useSetupGuard();
  const { isDark, isSunny } = useIsDark();
  const isDefaultLight = !isDark && !isSunny;
  const researchPapers = usePFCStore((s) => s.researchPapers);
  const currentCitations = usePFCStore((s) => s.currentCitations);
  const activeConcepts = usePFCStore((s) => s.activeConcepts);
  const messages = usePFCStore((s) => s.messages);
  const scanNotesForResearch = usePFCStore((s) => s.scanNotesForResearch);
  const noteBlocks = usePFCStore((s) => s.noteBlocks);

  // Auto-scan notes for research references on mount and when notes change
  useEffect(() => {
    if (noteBlocks.length > 0) {
      scanNotesForResearch();
    }
  }, [noteBlocks.length, scanNotesForResearch]);

  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') as LibraryTab | null;
  const [activeTab, setActiveTab] = useState<LibraryTab>(
    initialTab && VALID_TABS.includes(initialTab) ? initialTab : 'papers',
  );
  const [searchQuery, setSearchQuery] = useState('');

  // ── Derived data ──
  const authors = useMemo(() => extractAuthors(researchPapers), [researchPapers]);
  const suggestions = useMemo(
    () => generateSuggestions(researchPapers, activeConcepts),
    [researchPapers, activeConcepts],
  );

  // Extract unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const p of researchPapers) {
      for (const t of p.tags) tags.add(t);
    }
    return Array.from(tags).sort();
  }, [researchPapers]);

  // ── Filtered papers ──
  const filteredPapers = useMemo(() => {
    if (!searchQuery.trim()) return researchPapers;
    const q = searchQuery.toLowerCase();
    return researchPapers.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.authors.some((a) => a.toLowerCase().includes(q)) ||
        p.tags.some((t) => t.toLowerCase().includes(q)) ||
        (p.journal && p.journal.toLowerCase().includes(q)),
    );
  }, [researchPapers, searchQuery]);

  // ── Filtered authors ──
  const filteredAuthors = useMemo(() => {
    if (!searchQuery.trim()) return authors;
    const q = searchQuery.toLowerCase();
    return authors.filter(
      (a) => a.name.toLowerCase().includes(q) || a.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [authors, searchQuery]);

  // ── Stats ──
  const totalAuthors = authors.length;
  const totalCitations = currentCitations.length;
  const yearRange = researchPapers.length > 0
    ? {
        min: Math.min(...researchPapers.filter((p) => p.year > 0).map((p) => p.year)),
        max: Math.max(...researchPapers.filter((p) => p.year > 0).map((p) => p.year)),
      }
    : null;

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--chat-surface)]">
        <PixelBook size={40} />
      </div>
    );
  }

  return (
    <PageShell
      icon={LibraryIcon}
      iconColor="var(--color-pfc-green)"
      title="Research Library"
      subtitle="Your research brain — papers, thinkers, citations & reading suggestions"
    >
      {/* ── Stats row (flat oval pills) ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem', justifyContent: 'center' }}>
        <StatCard label="Papers" value={researchPapers.length} icon={FileTextIcon} color="#8B7CF6" isDark={isDark} isDefaultLight={isDefaultLight} />
        <StatCard label="Authors" value={totalAuthors} icon={UsersIcon} color="#22D3EE" isDark={isDark} isDefaultLight={isDefaultLight} />
        <StatCard label="Citations" value={totalCitations} icon={QuoteIcon} color="#F59E0B" isDark={isDark} isDefaultLight={isDefaultLight} />
        <StatCard label="Topics" value={allTags.length} icon={TagIcon} color="#34D399" isDark={isDark} isDefaultLight={isDefaultLight} />
      </div>

      {/* ── Tab bar ── */}
      <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap',
                isActive
                  ? 'bg-foreground/10 text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Search ── */}
      <div className="relative mb-5">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={
            activeTab === 'papers'
              ? 'Search papers, authors, tags...'
              : activeTab === 'thinkers'
              ? 'Search authors...'
              : 'Search...'
          }
          className="w-full rounded-lg border border-border/30 bg-card/30 pl-9 pr-4 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring/30"
        />
      </div>

      {/* ── Tab content ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
        >
          {/* Papers tab */}
          {activeTab === 'papers' && (
            <div className="space-y-3">
              {filteredPapers.length === 0 ? (
                <EmptyState
                  icon={BookOpenIcon}
                  title="No papers yet"
                  description="Papers will appear here as you search, save, and discuss research in chat. Use the Research tools to search Semantic Scholar."
                />
              ) : (
                <>
                  {yearRange && (
                    <div className="text-[11px] text-muted-foreground mb-2 flex items-center gap-1">
                      <TrendingUpIcon className="h-3 w-3" />
                      Spanning {yearRange.min}–{yearRange.max} · {filteredPapers.length} paper{filteredPapers.length > 1 ? 's' : ''}
                    </div>
                  )}
                  {filteredPapers.map((paper) => (
                    <PaperCard key={paper.id} paper={paper} isDark={isDark} />
                  ))}
                </>
              )}
            </div>
          )}

          {/* Thinkers & Authors tab */}
          {activeTab === 'thinkers' && (
            <div className="space-y-2">
              {filteredAuthors.length === 0 ? (
                <EmptyState
                  icon={UsersIcon}
                  title="No thinkers tracked yet"
                  description="Authors and researchers are extracted from your saved papers. Save papers via Research tools to populate this section."
                />
              ) : (
                <>
                  <div className="text-[11px] text-muted-foreground mb-2">
                    {filteredAuthors.length} researcher{filteredAuthors.length > 1 ? 's' : ''} across your library
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {filteredAuthors.map((author) => (
                      <AuthorCard key={author.name} author={author} isDark={isDark} isDefaultLight={isDefaultLight} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Citations tab */}
          {activeTab === 'citations' && (
            <div className="space-y-3">
              {currentCitations.length === 0 ? (
                <EmptyState
                  icon={QuoteIcon}
                  title="No citations collected"
                  description="Use the Citation Search tool in Research Hub to extract citations from your text. They'll appear here for reference."
                />
              ) : (
                currentCitations.map((citation: Citation) => (
                  <div
                    key={citation.id}
                    className={cn(
                      'rounded-lg border p-3',
                      isDark ? 'border-white/5 bg-white/[0.02]' : 'border-black/5 bg-black/[0.01]',
                    )}
                  >
                    <div className="text-sm leading-relaxed">{citation.text}</div>
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                      <span className="font-medium">{citation.source}</span>
                      {citation.year && (
                        <>
                          <span className="opacity-30">·</span>
                          <span>{citation.year}</span>
                        </>
                      )}
                      {citation.authors && citation.authors.length > 0 && (
                        <>
                          <span className="opacity-30">·</span>
                          <span>{citation.authors.slice(0, 2).join(', ')}</span>
                        </>
                      )}
                      <Badge variant="outline" className="text-[8px] ml-auto">
                        {Math.round(citation.confidence * 100)}% match
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Reading Suggestions tab */}
          {activeTab === 'suggestions' && (
            <div className="space-y-3">
              {suggestions.length === 0 ? (
                <EmptyState
                  icon={LightbulbIcon}
                  title="No suggestions yet"
                  description="Start researching topics and saving papers — personalized reading suggestions will appear based on your interests."
                />
              ) : (
                <>
                  <div className="text-[11px] text-muted-foreground mb-2 flex items-center gap-1">
                    <SparklesIcon className="h-3 w-3" />
                    Based on your {researchPapers.length} papers and {activeConcepts.length} active concepts
                  </div>
                  {suggestions.map((suggestion, i) => (
                    <div
                      key={i}
                      className={cn(
                        'rounded-lg border p-4',
                        isDark ? 'border-white/5 bg-white/[0.02]' : 'border-black/5 bg-black/[0.01]',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="rounded-md p-1.5 shrink-0 mt-0.5"
                          style={{ background: isDefaultLight ? '#EEEEEE' : isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.08)' }}
                        >
                          <BookOpenIcon className="h-4 w-4" style={{ color: isDefaultLight ? '#9E9E9E' : undefined }} />
                        </div>
                        <div>
                          <div className="text-sm font-medium">{suggestion.title}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                            {suggestion.reason}
                          </div>
                          <Badge variant="outline" className="text-[9px] mt-2">{suggestion.domain}</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Research Tools tab */}
          {activeTab === 'tools' && (
            <ResearchToolsTab isDark={isDark} isDefaultLight={isDefaultLight} />
          )}
        </motion.div>
      </AnimatePresence>
    </PageShell>
  );
}

// ── Empty state component ────────────────────────────────────────

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/20 mb-4" />
      <p className="text-sm text-muted-foreground/50 font-medium">{title}</p>
      <p className="text-xs text-muted-foreground/30 mt-1 max-w-[300px]">{description}</p>
    </div>
  );
}
