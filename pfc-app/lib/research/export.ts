import type { ExportFormat, ExportDataType, ResearchPaper } from './types';
import type { SignalHistoryEntry, CortexSnapshot } from '@/lib/store/use-pfc-store';
import type { ChatMessage } from '@/lib/engine/types';

// ═══════════════════════════════════════════════════════════════════
// Research Suite — Data Export System
// ═══════════════════════════════════════════════════════════════════

interface ExportPayload {
  signals?: SignalHistoryEntry[];
  papers?: ResearchPaper[];
  chatHistory?: ChatMessage[];
  cortexSnapshots?: CortexSnapshot[];
}

export function exportData(
  format: ExportFormat,
  dataType: ExportDataType,
  payload: ExportPayload,
): string {
  switch (format) {
    case 'json':
      return exportJSON(dataType, payload);
    case 'csv':
      return exportCSV(dataType, payload);
    case 'markdown':
      return exportMarkdown(dataType, payload);
    case 'bibtex':
      return exportBibTeX(payload.papers ?? []);
    case 'ris':
      return exportRIS(payload.papers ?? []);
    default:
      return exportJSON(dataType, payload);
  }
}

function exportJSON(dataType: ExportDataType, payload: ExportPayload): string {
  const data: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    dataType,
  };

  if (dataType === 'all' || dataType === 'signals') {
    data.signals = payload.signals ?? [];
  }
  if (dataType === 'all' || dataType === 'papers') {
    data.papers = payload.papers ?? [];
  }
  if (dataType === 'all' || dataType === 'chat-history') {
    data.chatHistory = payload.chatHistory ?? [];
  }
  if (dataType === 'all' || dataType === 'pipeline-runs') {
    data.cortexSnapshots = payload.cortexSnapshots ?? [];
  }

  return JSON.stringify(data, null, 2);
}

function exportCSV(dataType: ExportDataType, payload: ExportPayload): string {
  if (dataType === 'signals' && payload.signals) {
    const headers = 'timestamp,confidence,entropy,dissonance,healthScore,riskScore';
    const rows = payload.signals.map(
      (s) => `${new Date(s.timestamp).toISOString()},${s.confidence},${s.entropy},${s.dissonance},${s.healthScore},${s.riskScore}`,
    );
    return [headers, ...rows].join('\n');
  }

  if (dataType === 'papers' && payload.papers) {
    const headers = 'title,authors,year,journal,doi,url,tags,savedAt';
    const rows = payload.papers.map(
      (p) =>
        `"${esc(p.title)}","${esc(p.authors.join('; '))}",${p.year},"${esc(p.journal ?? '')}","${esc(p.doi ?? '')}","${esc(p.url ?? '')}","${esc(p.tags.join('; '))}",${new Date(p.savedAt).toISOString()}`,
    );
    return [headers, ...rows].join('\n');
  }

  if (dataType === 'chat-history' && payload.chatHistory) {
    const headers = 'id,role,timestamp,confidence,evidenceGrade,text';
    const rows = payload.chatHistory.map(
      (m) =>
        `"${m.id}","${m.role}","${new Date(m.timestamp).toISOString()}",${m.confidence ?? ''},${m.evidenceGrade ?? ''},"${esc(m.text.slice(0, 500))}"`,
    );
    return [headers, ...rows].join('\n');
  }

  return exportJSON(dataType, payload);
}

function exportMarkdown(dataType: ExportDataType, payload: ExportPayload): string {
  const lines: string[] = [`# PFC Research Export`, ``, `**Exported:** ${new Date().toISOString()}`, `**Type:** ${dataType}`, ``];

  if ((dataType === 'all' || dataType === 'papers') && payload.papers?.length) {
    lines.push(`## Research Papers`, ``);
    for (const p of payload.papers) {
      lines.push(`### ${p.title}`);
      lines.push(`- **Authors:** ${p.authors.join(', ')}`);
      lines.push(`- **Year:** ${p.year}`);
      if (p.journal) lines.push(`- **Journal:** ${p.journal}`);
      if (p.doi) lines.push(`- **DOI:** ${p.doi}`);
      if (p.url) lines.push(`- **URL:** ${p.url}`);
      if (p.abstract) lines.push(``, `> ${p.abstract}`);
      if (p.notes) lines.push(``, `**Notes:** ${p.notes}`);
      lines.push(``);
    }
  }

  if ((dataType === 'all' || dataType === 'signals') && payload.signals?.length) {
    lines.push(`## Signal History`, ``);
    lines.push(`| Timestamp | Confidence | Entropy | Dissonance | Health | Risk |`);
    lines.push(`|-----------|-----------|---------|------------|--------|------|`);
    for (const s of payload.signals) {
      lines.push(
        `| ${new Date(s.timestamp).toLocaleString()} | ${s.confidence.toFixed(3)} | ${s.entropy.toFixed(3)} | ${s.dissonance.toFixed(3)} | ${s.healthScore.toFixed(3)} | ${s.riskScore.toFixed(3)} |`,
      );
    }
    lines.push(``);
  }

  if ((dataType === 'all' || dataType === 'chat-history') && payload.chatHistory?.length) {
    lines.push(`## Chat History`, ``);
    for (const m of payload.chatHistory) {
      const role = m.role === 'user' ? 'User' : 'PFC Engine';
      lines.push(`**${role}** *(${new Date(m.timestamp).toLocaleString()})*`);
      if (m.confidence) lines.push(`Confidence: ${m.confidence.toFixed(3)} | Grade: ${m.evidenceGrade ?? 'N/A'}`);
      lines.push(``, m.text.slice(0, 1000), ``);
      lines.push(`---`, ``);
    }
  }

  return lines.join('\n');
}

function exportBibTeX(papers: ResearchPaper[]): string {
  return papers
    .map((p) => {
      const key = `${p.authors[0]?.split(' ').pop() ?? 'unknown'}${p.year}`;
      const lines = [
        `@article{${key},`,
        `  title = {${p.title}},`,
        `  author = {${p.authors.join(' and ')}},`,
        `  year = {${p.year}},`,
      ];
      if (p.journal) lines.push(`  journal = {${p.journal}},`);
      if (p.doi) lines.push(`  doi = {${p.doi}},`);
      if (p.url) lines.push(`  url = {${p.url}},`);
      lines.push(`}`);
      return lines.join('\n');
    })
    .join('\n\n');
}

function exportRIS(papers: ResearchPaper[]): string {
  return papers
    .map((p) => {
      const lines = [
        `TY  - JOUR`,
        `TI  - ${p.title}`,
        ...p.authors.map((a) => `AU  - ${a}`),
        `PY  - ${p.year}`,
      ];
      if (p.journal) lines.push(`JO  - ${p.journal}`);
      if (p.doi) lines.push(`DO  - ${p.doi}`);
      if (p.url) lines.push(`UR  - ${p.url}`);
      if (p.abstract) lines.push(`AB  - ${p.abstract}`);
      lines.push(`ER  - `);
      return lines.join('\n');
    })
    .join('\n\n');
}

/** Trigger a file download in the browser */
export function downloadExport(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Get mime type for export format */
export function getMimeType(format: ExportFormat): string {
  switch (format) {
    case 'json': return 'application/json';
    case 'csv': return 'text/csv';
    case 'markdown': return 'text/markdown';
    case 'bibtex': return 'application/x-bibtex';
    case 'ris': return 'application/x-research-info-systems';
    default: return 'text/plain';
  }
}

function esc(s: string): string {
  return s.replace(/"/g, '""');
}
