'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { useSetupGuard } from '@/hooks/use-setup-guard';
import { PageShell, GlassSection } from '@/components/page-shell';
import { PixelBook } from '@/components/pixel-book';
import { GlassBubbleButton } from '@/components/glass-bubble-button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  LibraryIcon,
  SearchIcon,
  PlusIcon,
  Trash2Icon,
  ExternalLinkIcon,
  TagIcon,
  StickyNoteIcon,
  DownloadIcon,
  FilterIcon,
  BookOpenIcon,
} from 'lucide-react';
import { exportData, downloadExport, getMimeType } from '@/lib/research/export';
import type { ResearchPaper, ExportFormat } from '@/lib/research/types';

export default function ResearchLibraryPage() {
  const ready = useSetupGuard();
  const papers = usePFCStore((s) => s.researchPapers);
  const addResearchPaper = usePFCStore((s) => s.addResearchPaper);
  const removeResearchPaper = usePFCStore((s) => s.removeResearchPaper);
  const updateResearchPaper = usePFCStore((s) => s.updateResearchPaper);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  // Add form state
  const [newTitle, setNewTitle] = useState('');
  const [newAuthors, setNewAuthors] = useState('');
  const [newYear, setNewYear] = useState(new Date().getFullYear().toString());
  const [newJournal, setNewJournal] = useState('');
  const [newDoi, setNewDoi] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newAbstract, setNewAbstract] = useState('');

  // All unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    papers.forEach((p) => p.tags.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [papers]);

  // Filtered papers
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

  const handleAdd = useCallback(() => {
    if (!newTitle.trim()) return;
    const paper: ResearchPaper = {
      id: `paper-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: newTitle.trim(),
      authors: newAuthors.split(',').map((a) => a.trim()).filter(Boolean),
      year: parseInt(newYear) || new Date().getFullYear(),
      journal: newJournal.trim() || undefined,
      doi: newDoi.trim() || undefined,
      url: newUrl.trim() || undefined,
      abstract: newAbstract.trim() || undefined,
      tags: newTags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
      savedAt: Date.now(),
    };
    addResearchPaper(paper);
    setNewTitle('');
    setNewAuthors('');
    setNewYear(new Date().getFullYear().toString());
    setNewJournal('');
    setNewDoi('');
    setNewUrl('');
    setNewTags('');
    setNewAbstract('');
    setShowAddForm(false);
  }, [newTitle, newAuthors, newYear, newJournal, newDoi, newUrl, newTags, newAbstract, addResearchPaper]);

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
      subtitle="Saved articles, research papers, and citations"
    >
      <div className="space-y-6">
        {/* Search & Filter Bar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <SearchIcon
              className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40"
            />
            <Input
              placeholder="Search papers, authors, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-full text-sm"
            />
          </div>
          <GlassBubbleButton
            size="sm"
            color="green"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Add Paper
          </GlassBubbleButton>
        </div>

        {/* Tag Filter */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <FilterIcon className="h-3 w-3 text-muted-foreground/40" />
            <button
              onClick={() => setSelectedTag(null)}
              className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                !selectedTag
                  ? 'bg-pfc-green/20 text-pfc-green'
                  : 'bg-muted/30 text-muted-foreground/50 hover:bg-muted/50'
              }`}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                  selectedTag === tag
                    ? 'bg-pfc-green/20 text-pfc-green'
                    : 'bg-muted/30 text-muted-foreground/50 hover:bg-muted/50'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Add Form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: 1, scaleY: 1 }}
              exit={{ opacity: 0, scaleY: 0 }}
              style={{ transformOrigin: 'top', transform: 'translateZ(0)' }}
            >
              <GlassSection title="Add New Paper">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-sm font-semibold text-muted-foreground mb-1.5 block">
                      Title *
                    </label>
                    <Input
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Paper title"
                      className="rounded-full text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-semibold text-muted-foreground mb-1.5 block">
                      Authors (comma-separated)
                    </label>
                    <Input
                      value={newAuthors}
                      onChange={(e) => setNewAuthors(e.target.value)}
                      placeholder="Smith, J., Doe, A."
                      className="rounded-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-muted-foreground mb-1.5 block">
                      Year
                    </label>
                    <Input
                      value={newYear}
                      onChange={(e) => setNewYear(e.target.value)}
                      placeholder="2024"
                      className="rounded-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-muted-foreground mb-1.5 block">
                      Journal
                    </label>
                    <Input
                      value={newJournal}
                      onChange={(e) => setNewJournal(e.target.value)}
                      placeholder="Nature, Science, etc."
                      className="rounded-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-muted-foreground mb-1.5 block">
                      DOI
                    </label>
                    <Input
                      value={newDoi}
                      onChange={(e) => setNewDoi(e.target.value)}
                      placeholder="10.1000/xyz123"
                      className="rounded-full text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-muted-foreground mb-1.5 block">
                      URL
                    </label>
                    <Input
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      placeholder="https://..."
                      className="rounded-full text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-semibold text-muted-foreground mb-1.5 block">
                      Tags (comma-separated)
                    </label>
                    <Input
                      value={newTags}
                      onChange={(e) => setNewTags(e.target.value)}
                      placeholder="neuroscience, meta-analysis, rct"
                      className="rounded-full text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-semibold text-muted-foreground mb-1.5 block">
                      Abstract
                    </label>
                    <textarea
                      value={newAbstract}
                      onChange={(e) => setNewAbstract(e.target.value)}
                      placeholder="Paper abstract..."
                      rows={3}
                      className="w-full rounded-2xl border border-border/30 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-pfc-green/50 resize-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <GlassBubbleButton size="sm" color="green" onClick={handleAdd}>
                    Save Paper
                  </GlassBubbleButton>
                  <GlassBubbleButton
                    size="sm"
                    color="neutral"
                    onClick={() => setShowAddForm(false)}
                  >
                    Cancel
                  </GlassBubbleButton>
                </div>
              </GlassSection>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Export */}
        {papers.length > 0 && (
          <div className="flex items-center gap-2">
            <DownloadIcon className="h-3 w-3 text-muted-foreground/40" />
            <span className="text-xs text-muted-foreground/40">Export:</span>
            {(['json', 'csv', 'markdown', 'bibtex', 'ris'] as ExportFormat[]).map((fmt) => (
              <button
                key={fmt}
                onClick={() => handleExport(fmt)}
                className="text-xs px-2 py-0.5 rounded-full bg-muted/30 text-muted-foreground/50 hover:bg-muted/50 transition-colors uppercase font-mono"
              >
                {fmt}
              </button>
            ))}
          </div>
        )}

        {/* Paper List */}
        <GlassSection
          title={`Papers (${filteredPapers.length})`}
          badge={
            <span className="text-xs text-muted-foreground/40">
              {papers.length} total saved
            </span>
          }
        >
          {filteredPapers.length === 0 ? (
            <div className="text-center py-12">
              <BookOpenIcon className="h-10 w-10 mx-auto text-muted-foreground/15 mb-3" />
              <p className="text-sm text-muted-foreground/40">
                {papers.length === 0
                  ? 'No papers saved yet. Add papers manually or enable auto-extract in Research Chat mode.'
                  : 'No papers match your search.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPapers.map((paper) => (
                <motion.div
                  key={paper.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-border/20 p-4 space-y-2 hover:border-border/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold leading-tight">
                        {paper.title}
                      </h3>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        {paper.authors.join(', ')} ({paper.year})
                        {paper.journal && ` \u2022 ${paper.journal}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {paper.url && (
                        <a
                          href={paper.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg hover:bg-muted/30 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
                        >
                          <ExternalLinkIcon className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => {
                          if (editingId === paper.id) {
                            setEditingId(null);
                          } else {
                            setEditingId(paper.id);
                            setNoteText(paper.notes ?? '');
                          }
                        }}
                        className="p-1.5 rounded-lg hover:bg-muted/30 text-muted-foreground/40 hover:text-pfc-yellow transition-colors"
                      >
                        <StickyNoteIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => removeResearchPaper(paper.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground/40 hover:text-red-400 transition-colors"
                      >
                        <Trash2Icon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {paper.abstract && (
                    <p className="text-xs text-muted-foreground/40 line-clamp-2">
                      {paper.abstract}
                    </p>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    {paper.doi && (
                      <Badge
                        variant="secondary"
                        className="text-xs bg-pfc-violet/10 text-pfc-violet border-0 font-mono"
                      >
                        DOI: {paper.doi}
                      </Badge>
                    )}
                    {paper.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full bg-pfc-green/10 text-pfc-green"
                      >
                        <TagIcon className="h-2 w-2" />
                        {tag}
                      </span>
                    ))}
                  </div>

                  {paper.notes && editingId !== paper.id && (
                    <div className="rounded-lg bg-pfc-yellow/5 border border-pfc-yellow/10 p-2">
                      <p className="text-xs text-pfc-yellow/70">{paper.notes}</p>
                    </div>
                  )}

                  {/* Note editing */}
                  <AnimatePresence>
                    {editingId === paper.id && (
                      <motion.div
                        initial={{ opacity: 0, scaleY: 0 }}
                        animate={{ opacity: 1, scaleY: 1 }}
                        exit={{ opacity: 0, scaleY: 0 }}
                        className="pt-2"
                        style={{ transformOrigin: 'top', transform: 'translateZ(0)' }}
                      >
                        <textarea
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="Add notes..."
                          rows={2}
                          className="w-full rounded-lg border border-border/30 bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-pfc-yellow/50 resize-none mb-2"
                        />
                        <div className="flex gap-2">
                          <GlassBubbleButton
                            size="sm"
                            color="ember"
                            onClick={() => handleSaveNote(paper.id)}
                          >
                            Save Note
                          </GlassBubbleButton>
                          <GlassBubbleButton
                            size="sm"
                            color="neutral"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </GlassBubbleButton>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}
        </GlassSection>
      </div>
    </PageShell>
  );
}
