'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
  FlaskConicalIcon,
  SendIcon,
  ChevronRightIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  TrendingUpIcon,
  ShieldCheckIcon,
  SparklesIcon,
  ZapIcon,
  BookOpenIcon,
  GaugeIcon,
  XIcon,
  PlusIcon,
  BrainCircuitIcon,
  LayersIcon,
  TargetIcon,
  ActivityIcon,
  FolderOpenIcon,
  FileTextIcon,
  UploadIcon,
} from 'lucide-react';

import { PageShell, GlassSection } from '@/components/page-shell';
import { PixelBook } from '@/components/pixel-book';
import { useSetupGuard } from '@/hooks/use-setup-guard';
import { GlassBubbleButton } from '@/components/glass-bubble-button';
import type {
  MLProjectEvaluation,
  MLProjectInput,
  ProjectType,
  DimensionScore,
} from '@/lib/engine/ml-evaluator';

// ---------------------------------------------------------------------------
// Constants & Config
// ---------------------------------------------------------------------------

const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: 'classifier', label: 'Classifier' },
  { value: 'regressor', label: 'Regressor' },
  { value: 'recommender', label: 'Recommender' },
  { value: 'clustering', label: 'Clustering' },
  { value: 'anomaly_detection', label: 'Anomaly Detection' },
  { value: 'time_series', label: 'Time Series' },
  { value: 'nlp_pipeline', label: 'NLP Pipeline' },
  { value: 'computer_vision', label: 'Computer Vision' },
  { value: 'reinforcement_learning', label: 'RL' },
  { value: 'data_tool', label: 'Data Tool' },
  { value: 'etl_pipeline', label: 'ETL Pipeline' },
  { value: 'general_ml', label: 'General ML' },
];

const DIMENSION_ICONS: Record<string, React.ReactNode> = {
  architecture: <LayersIcon style={{ width: 14, height: 14 }} />,
  data_handling: <ActivityIcon style={{ width: 14, height: 14 }} />,
  feature_engineering: <SparklesIcon style={{ width: 14, height: 14 }} />,
  model_selection: <TargetIcon style={{ width: 14, height: 14 }} />,
  training_methodology: <BrainCircuitIcon style={{ width: 14, height: 14 }} />,
  evaluation_rigor: <GaugeIcon style={{ width: 14, height: 14 }} />,
  robustness: <ShieldCheckIcon style={{ width: 14, height: 14 }} />,
  interpretability: <BookOpenIcon style={{ width: 14, height: 14 }} />,
  code_quality: <ZapIcon style={{ width: 14, height: 14 }} />,
  deployment_readiness: <FlaskConicalIcon style={{ width: 14, height: 14 }} />,
  innovation: <SparklesIcon style={{ width: 14, height: 14 }} />,
  documentation: <BookOpenIcon style={{ width: 14, height: 14 }} />,
};

/* Cupertino easing */
const CUPERTINO = 'cubic-bezier(0.32, 0.72, 0, 1)';
const SPRING_SNAPPY = { type: 'spring' as const, stiffness: 500, damping: 30, mass: 0.5 };
const SPRING_SOFT = { type: 'spring' as const, stiffness: 350, damping: 28, mass: 0.6 };

// ---------------------------------------------------------------------------
// Score helpers
// ---------------------------------------------------------------------------

function scoreColor(score: number): string {
  if (score >= 0.7) return '#34D399';
  if (score >= 0.5) return '#FBBF24';
  return '#F87171';
}

function gradeAccent(grade: string): string {
  if (grade.startsWith('A')) return '#34D399';
  if (grade.startsWith('B')) return '#22D3EE';
  if (grade.startsWith('C')) return '#FBBF24';
  return '#F87171';
}

// ---------------------------------------------------------------------------
// GlassInput — consistent styled input
// ---------------------------------------------------------------------------

function GlassInput({
  value,
  onChange,
  placeholder,
  isDark,
  type = 'text',
  style: styleProp,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  isDark: boolean;
  type?: string;
  style?: React.CSSProperties;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%',
        padding: '0.5rem 0.75rem',
        borderRadius: '0.625rem',
        border: `1px solid ${isDark ? 'rgba(79,69,57,0.4)' : 'rgba(0,0,0,0.08)'}`,
        background: isDark ? 'rgba(30,28,26,0.6)' : 'rgba(255,255,255,0.5)',
        backdropFilter: 'blur(8px)',
        color: isDark ? 'rgba(237,224,212,0.9)' : 'rgba(0,0,0,0.75)',
        fontSize: '0.8125rem',
        outline: 'none',
        transition: `border 0.2s ${CUPERTINO}, box-shadow 0.2s ${CUPERTINO}`,
        ...styleProp,
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = 'rgba(var(--pfc-accent-rgb), 0.4)';
        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(var(--pfc-accent-rgb), 0.08)';
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = isDark ? 'rgba(79,69,57,0.4)' : 'rgba(0,0,0,0.08)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Tag pill
// ---------------------------------------------------------------------------

function TagPill({
  label,
  onRemove,
  isDark,
}: {
  label: string;
  onRemove: () => void;
  isDark: boolean;
}) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={SPRING_SNAPPY}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.2rem 0.5rem',
        borderRadius: '9999px',
        fontSize: '0.6875rem',
        fontWeight: 600,
        background: isDark ? 'rgba(var(--pfc-accent-rgb), 0.1)' : 'rgba(var(--pfc-accent-rgb), 0.08)',
        color: isDark ? 'rgba(var(--pfc-accent-rgb), 0.9)' : 'rgba(160,120,80,0.9)',
        border: `1px solid ${isDark ? 'rgba(var(--pfc-accent-rgb), 0.15)' : 'rgba(var(--pfc-accent-rgb), 0.12)'}`,
        cursor: 'pointer',
      }}
      onClick={onRemove}
    >
      {label}
      <XIcon style={{ width: 10, height: 10, opacity: 0.6 }} />
    </motion.span>
  );
}

// ---------------------------------------------------------------------------
// Animated Score Ring
// ---------------------------------------------------------------------------

function ScoreRing({
  value,
  max,
  size = 80,
  strokeWidth = 5,
  color,
  isDark,
  children,
}: {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  isDark: boolean;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value / max, 1);

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isDark ? 'rgba(79,69,57,0.3)' : 'rgba(0,0,0,0.06)'}
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - progress) }}
          transition={{ duration: 1, ease: [0.32, 0.72, 0, 1], delay: 0.2 }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dimension Row — horizontal bar with expand
// ---------------------------------------------------------------------------

function DimensionRow({
  dim,
  index,
  isDark,
}: {
  dim: DimensionScore;
  index: number;
  isDark: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const color = scoreColor(dim.score);
  const pct = Math.round(dim.score * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING_SOFT, delay: index * 0.04 }}
      style={{
        borderRadius: '0.75rem',
        border: `1px solid ${isDark ? 'rgba(79,69,57,0.3)' : 'rgba(0,0,0,0.06)'}`,
        overflow: 'hidden',
        background: isDark ? 'rgba(30,28,26,0.4)' : 'rgba(255,255,255,0.4)',
        transition: `border-color 0.2s ${CUPERTINO}`,
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
          cursor: 'pointer',
          border: 'none',
          background: 'transparent',
          color: 'inherit',
          textAlign: 'left',
        }}
      >
        {/* Icon */}
        <span style={{ color, opacity: 0.8, flexShrink: 0 }}>
          {DIMENSION_ICONS[dim.dimension] ?? <FlaskConicalIcon style={{ width: 14, height: 14 }} />}
        </span>

        {/* Label */}
        <span
          style={{
            flex: 1,
            fontSize: '0.8125rem',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            textTransform: 'capitalize',
            color: isDark ? 'rgba(237,224,212,0.85)' : 'rgba(0,0,0,0.7)',
          }}
        >
          {dim.dimension.replace(/_/g, ' ')}
        </span>

        {/* Score + Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 120 }}>
          <div
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: isDark ? 'rgba(79,69,57,0.3)' : 'rgba(0,0,0,0.06)',
              overflow: 'hidden',
            }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1], delay: index * 0.04 + 0.2 }}
              style={{
                height: '100%',
                borderRadius: 2,
                background: color,
              }}
            />
          </div>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color,
              minWidth: 32,
              textAlign: 'right',
            }}
          >
            {pct}%
          </span>
        </div>

        {/* Grade badge */}
        <span
          style={{
            fontSize: '0.625rem',
            fontWeight: 700,
            padding: '0.125rem 0.375rem',
            borderRadius: '9999px',
            background: `${gradeAccent(dim.grade)}15`,
            color: gradeAccent(dim.grade),
            border: `1px solid ${gradeAccent(dim.grade)}25`,
          }}
        >
          {dim.grade}
        </span>

        {/* Chevron */}
        <motion.span
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={SPRING_SNAPPY}
          style={{ color: isDark ? 'rgba(156,143,128,0.4)' : 'rgba(0,0,0,0.2)', flexShrink: 0 }}
        >
          <ChevronRightIcon style={{ width: 14, height: 14 }} />
        </motion.span>
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                padding: '0 1rem 1rem',
                borderTop: `1px solid ${isDark ? 'rgba(79,69,57,0.2)' : 'rgba(0,0,0,0.04)'}`,
                paddingTop: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.625rem',
              }}
            >
              {dim.findings.length > 0 && (
                <div>
                  <p
                    style={{
                      fontSize: '0.5625rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.3)',
                      marginBottom: '0.375rem',
                    }}
                  >
                    Findings
                  </p>
                  {dim.findings.map((f, i) => (
                    <p
                      key={i}
                      style={{
                        fontSize: '0.6875rem',
                        color: isDark ? 'rgba(237,224,212,0.6)' : 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.375rem',
                        marginBottom: '0.25rem',
                        lineHeight: 1.5,
                      }}
                    >
                      <CheckCircle2Icon style={{ width: 11, height: 11, marginTop: 2, flexShrink: 0, color: '#34D399', opacity: 0.6 }} />
                      {f}
                    </p>
                  ))}
                </div>
              )}

              {dim.recommendations.length > 0 && (
                <div>
                  <p
                    style={{
                      fontSize: '0.5625rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: 'rgba(var(--pfc-accent-rgb), 0.6)',
                      marginBottom: '0.375rem',
                    }}
                  >
                    Recommendations
                  </p>
                  {dim.recommendations.map((r, i) => (
                    <p
                      key={i}
                      style={{
                        fontSize: '0.6875rem',
                        color: isDark ? 'rgba(237,224,212,0.6)' : 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.375rem',
                        marginBottom: '0.25rem',
                        lineHeight: 1.5,
                      }}
                    >
                      <TrendingUpIcon style={{ width: 11, height: 11, marginTop: 2, flexShrink: 0, color: 'var(--pfc-accent)', opacity: 0.6 }} />
                      {r}
                    </p>
                  ))}
                </div>
              )}

              <p
                style={{
                  fontSize: '0.625rem',
                  color: isDark ? 'rgba(156,143,128,0.4)' : 'rgba(0,0,0,0.25)',
                  fontStyle: 'italic',
                  marginTop: '0.125rem',
                }}
              >
                {dim.benchmarkComparison}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// RobustnessBar — mini labeled progress bar
// ---------------------------------------------------------------------------

function MetricBar({
  label,
  value,
  isDark,
}: {
  label: string;
  value: number;
  isDark: boolean;
}) {
  const pct = Math.round(value * 100);
  const color = scoreColor(value);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: '0.6875rem', color: isDark ? 'rgba(237,224,212,0.55)' : 'rgba(0,0,0,0.45)' }}>
          {label}
        </span>
        <span style={{ fontSize: '0.6875rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color }}>
          {pct}%
        </span>
      </div>
      <div style={{ height: 3, borderRadius: 1.5, background: isDark ? 'rgba(79,69,57,0.25)' : 'rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
          style={{ height: '100%', borderRadius: 1.5, background: color }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function EvaluatePage() {
  const ready = useSetupGuard();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted ? (resolvedTheme === 'dark' || resolvedTheme === 'oled') : true;

  // Form state
  const [input, setInput] = useState<Partial<MLProjectInput>>({
    name: '',
    description: '',
    projectType: 'general_ml',
    techStack: [],
    hasTests: false,
    hasDocumentation: false,
    modelArchitecture: '',
    datasetSize: '',
    concerns: [],
    performanceMetrics: {},
  });
  const [evaluation, setEvaluation] = useState<MLProjectEvaluation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importedFiles, setImportedFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Results ref for scroll-to
  const resultsRef = useRef<HTMLDivElement>(null);

  // Auto-detect project metadata from imported files
  const autoFillFromFiles = useCallback(async (files: File[]) => {
    setImporting(true);
    try {
      const fileContents: string[] = [];
      const fileNames = files.map(f => f.name);
      const techSet = new Set<string>();
      let totalSize = 0;
      let hasTestFiles = false;
      let hasDocFiles = false;
      let detectedArch = '';
      let detectedType: ProjectType = 'general_ml';

      for (const file of files) {
        totalSize += file.size;
        const name = file.name.toLowerCase();

        // Detect tests
        if (name.includes('test') || name.includes('spec') || name.includes('__test__')) hasTestFiles = true;
        // Detect docs
        if (name.endsWith('.md') || name.endsWith('.rst') || name.endsWith('.txt') || name === 'readme') hasDocFiles = true;

        // Detect tech stack from file extensions & names
        if (name.endsWith('.py')) techSet.add('Python');
        if (name.endsWith('.ipynb')) techSet.add('Jupyter');
        if (name.endsWith('.r') || name.endsWith('.rmd')) techSet.add('R');
        if (name.endsWith('.ts') || name.endsWith('.tsx')) techSet.add('TypeScript');
        if (name.endsWith('.js') || name.endsWith('.jsx')) techSet.add('JavaScript');
        if (name === 'requirements.txt' || name === 'pyproject.toml') techSet.add('Python');
        if (name === 'package.json') techSet.add('Node.js');
        if (name === 'cargo.toml') techSet.add('Rust');
        if (name === 'dockerfile' || name.startsWith('docker-compose')) techSet.add('Docker');

        // Read text files for content analysis
        if (file.size < 500_000 && (name.endsWith('.py') || name.endsWith('.ipynb') || name.endsWith('.ts') || name.endsWith('.js') || name.endsWith('.r') || name.endsWith('.md'))) {
          try {
            const text = await file.text();
            fileContents.push(text);

            // Detect frameworks
            if (text.includes('import torch') || text.includes('from torch')) techSet.add('PyTorch');
            if (text.includes('import tensorflow') || text.includes('from tensorflow')) techSet.add('TensorFlow');
            if (text.includes('import sklearn') || text.includes('from sklearn')) techSet.add('scikit-learn');
            if (text.includes('import keras') || text.includes('from keras')) techSet.add('Keras');
            if (text.includes('import xgboost') || text.includes('from xgboost')) { techSet.add('XGBoost'); detectedArch = detectedArch || 'XGBoost'; }
            if (text.includes('import lightgbm') || text.includes('from lightgbm')) { techSet.add('LightGBM'); detectedArch = detectedArch || 'LightGBM'; }
            if (text.includes('import pandas') || text.includes('from pandas')) techSet.add('pandas');
            if (text.includes('import numpy') || text.includes('from numpy')) techSet.add('NumPy');
            if (text.includes('import transformers') || text.includes('from transformers')) { techSet.add('Hugging Face'); detectedType = 'nlp_pipeline'; }
            if (text.includes('import cv2') || text.includes('from torchvision')) { detectedType = 'computer_vision'; detectedArch = detectedArch || 'CNN'; }
            if (text.includes('LSTM') || text.includes('GRU')) { detectedArch = detectedArch || 'LSTM/GRU'; detectedType = 'time_series'; }
            if (text.includes('RandomForest') || text.includes('random_forest')) detectedArch = detectedArch || 'Random Forest';
            if (text.includes('ResNet') || text.includes('resnet')) detectedArch = detectedArch || 'ResNet';
            if (text.includes('BERT') || text.includes('bert')) detectedArch = detectedArch || 'BERT';
            if (text.includes('KMeans') || text.includes('DBSCAN')) detectedType = 'clustering';
            if (text.includes('IsolationForest') || text.includes('anomaly')) detectedType = 'anomaly_detection';
            if (text.includes('gym') || text.includes('stable_baselines')) detectedType = 'reinforcement_learning';
          } catch { /* skip binary files */ }
        }
      }

      // Format dataset size
      const sizeStr = totalSize > 1_000_000
        ? `${(totalSize / 1_000_000).toFixed(1)}MB (${files.length} files)`
        : `${(totalSize / 1_000).toFixed(0)}KB (${files.length} files)`;

      // Build auto-filled name from folder structure
      const autoName = input.name || (files.length > 0 ? files[0].webkitRelativePath?.split('/')[0] || '' : '');

      setInput(prev => ({
        ...prev,
        name: autoName || prev.name,
        techStack: Array.from(techSet),
        hasTests: hasTestFiles || (prev.hasTests ?? false),
        hasDocumentation: hasDocFiles || (prev.hasDocumentation ?? false),
        modelArchitecture: detectedArch || prev.modelArchitecture,
        datasetSize: sizeStr,
        projectType: detectedType !== 'general_ml' ? detectedType : (prev.projectType ?? 'general_ml'),
      }));

      // Build a description snippet from file names
      if (!input.description) {
        const snippet = `ML project with ${files.length} files: ${fileNames.slice(0, 8).join(', ')}${files.length > 8 ? ` and ${files.length - 8} more` : ''}. Tech: ${Array.from(techSet).join(', ') || 'unknown'}.${detectedArch ? ` Architecture: ${detectedArch}.` : ''}`;
        setInput(prev => ({ ...prev, description: prev.description || snippet }));
      }
    } finally {
      setImporting(false);
    }
  }, [input.name, input.description]);

  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      setImportedFiles(files);
      autoFillFromFiles(files);
    }
  }, [autoFillFromFiles]);

  const handleEvaluate = async () => {
    if (!input.name || !input.description) {
      setError('Please provide a project name and description');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Evaluation failed');
      }
      const result = await res.json();
      setEvaluation(result);
      // Smooth scroll to results after a tick
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Evaluation failed');
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--chat-surface)' }}>
        <PixelBook size={40} />
      </div>
    );
  }

  return (
    <PageShell
      icon={FlaskConicalIcon}
      iconColor="var(--color-pfc-ember)"
      title="ML Evaluator"
      subtitle="12-dimension intelligence assessment for ML projects"
    >
      {/* ═══════════════════════════════════════════════════════
          Input Form — streamlined with import
         ═══════════════════════════════════════════════════════ */}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".py,.ipynb,.ts,.tsx,.js,.jsx,.r,.rmd,.md,.txt,.json,.yaml,.yml,.toml,.cfg,.csv"
        style={{ display: 'none' }}
        onChange={handleFileImport}
      />
      <input
        ref={folderInputRef}
        type="file"
        {...{ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>}
        multiple
        style={{ display: 'none' }}
        onChange={handleFileImport}
      />

      <GlassSection title="Project Details">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Import Area — drop zone style */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_SOFT, delay: 0.05 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
              padding: '2rem 1.5rem',
              borderRadius: '1rem',
              border: `2px dashed ${importedFiles.length > 0 ? 'rgba(var(--pfc-accent-rgb), 0.4)' : isDark ? 'rgba(79,69,57,0.35)' : 'rgba(0,0,0,0.1)'}`,
              background: importedFiles.length > 0
                ? (isDark ? 'rgba(var(--pfc-accent-rgb), 0.04)' : 'rgba(var(--pfc-accent-rgb), 0.03)')
                : (isDark ? 'rgba(30,28,26,0.3)' : 'rgba(255,255,255,0.3)'),
              transition: `all 0.3s ${CUPERTINO}`,
            }}
          >
            <motion.div
              animate={importing ? { rotate: 360 } : { rotate: 0 }}
              transition={importing ? { duration: 1.5, repeat: Infinity, ease: 'linear' } : { duration: 0.3 }}
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: importedFiles.length > 0
                  ? 'rgba(var(--pfc-accent-rgb), 0.12)'
                  : (isDark ? 'rgba(79,69,57,0.15)' : 'rgba(0,0,0,0.04)'),
                color: importedFiles.length > 0
                  ? 'var(--pfc-accent)'
                  : (isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.3)'),
                transition: `all 0.3s ${CUPERTINO}`,
              }}
            >
              {importing ? (
                <FlaskConicalIcon style={{ width: 22, height: 22 }} />
              ) : importedFiles.length > 0 ? (
                <CheckCircle2Icon style={{ width: 22, height: 22 }} />
              ) : (
                <UploadIcon style={{ width: 22, height: 22 }} />
              )}
            </motion.div>

            {importedFiles.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={SPRING_SNAPPY}
                style={{ textAlign: 'center' }}
              >
                <p style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--pfc-accent)',
                  marginBottom: '0.25rem',
                }}>
                  {importedFiles.length} file{importedFiles.length !== 1 ? 's' : ''} imported
                </p>
                <p style={{
                  fontSize: '0.6875rem',
                  color: isDark ? 'rgba(156,143,128,0.6)' : 'rgba(0,0,0,0.4)',
                }}>
                  Project details auto-filled below
                </p>
              </motion.div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <p style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: isDark ? 'rgba(237,224,212,0.7)' : 'rgba(0,0,0,0.55)',
                  marginBottom: '0.25rem',
                }}>
                  Import your ML project
                </p>
                <p style={{
                  fontSize: '0.6875rem',
                  color: isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.35)',
                }}>
                  Auto-detects tech stack, architecture, and project type
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <GlassBubbleButton
                onClick={() => fileInputRef.current?.click()}
                color="ember"
                size="sm"
              >
                <FileTextIcon style={{ width: 14, height: 14 }} />
                Select Files
              </GlassBubbleButton>
              <GlassBubbleButton
                onClick={() => folderInputRef.current?.click()}
                color="ember"
                size="sm"
              >
                <FolderOpenIcon style={{ width: 14, height: 14 }} />
                Import Folder
              </GlassBubbleButton>
            </div>
          </motion.div>

          {/* Auto-filled tags preview */}
          <AnimatePresence>
            {(input.techStack ?? []).length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '0.5625rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.3)',
                    marginRight: '0.25rem',
                  }}>
                    Detected:
                  </span>
                  {input.projectType && input.projectType !== 'general_ml' && (
                    <span style={{
                      fontSize: '0.625rem',
                      fontWeight: 600,
                      padding: '0.125rem 0.5rem',
                      borderRadius: '9999px',
                      background: 'rgba(34,211,238,0.08)',
                      color: '#22D3EE',
                      border: '1px solid rgba(34,211,238,0.15)',
                    }}>
                      {PROJECT_TYPES.find(p => p.value === input.projectType)?.label ?? input.projectType}
                    </span>
                  )}
                  {input.modelArchitecture && (
                    <span style={{
                      fontSize: '0.625rem',
                      fontWeight: 600,
                      padding: '0.125rem 0.5rem',
                      borderRadius: '9999px',
                      background: 'rgba(var(--pfc-accent-rgb), 0.08)',
                      color: 'var(--pfc-accent)',
                      border: '1px solid rgba(var(--pfc-accent-rgb), 0.15)',
                    }}>
                      {input.modelArchitecture}
                    </span>
                  )}
                  <AnimatePresence mode="popLayout">
                    {(input.techStack ?? []).map((t, i) => (
                      <TagPill
                        key={`${t}-${i}`}
                        label={t}
                        isDark={isDark}
                        onRemove={() =>
                          setInput(prev => ({
                            ...prev,
                            techStack: (prev.techStack ?? []).filter((_, idx) => idx !== i),
                          }))
                        }
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Project Name */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_SOFT, delay: 0.1 }}
          >
            <label
              style={{
                display: 'block',
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: isDark ? 'rgba(156,143,128,0.7)' : 'rgba(0,0,0,0.45)',
                marginBottom: '0.375rem',
                letterSpacing: '0.02em',
              }}
            >
              Project Name *
            </label>
            <GlassInput
              value={input.name ?? ''}
              onChange={(v) => setInput(prev => ({ ...prev, name: v }))}
              placeholder="e.g. Customer Churn Predictor"
              isDark={isDark}
            />
          </motion.div>

          {/* Description */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_SOFT, delay: 0.15 }}
          >
            <label
              style={{
                display: 'block',
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: isDark ? 'rgba(156,143,128,0.7)' : 'rgba(0,0,0,0.45)',
                marginBottom: '0.375rem',
                letterSpacing: '0.02em',
              }}
            >
              Project Description *
            </label>
            <textarea
              value={input.description}
              onChange={(e) => setInput(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what your ML project does, the problem it solves, data sources, preprocessing steps, training approach, and any specific techniques used. Or import files above to auto-generate."
              rows={4}
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                borderRadius: '0.625rem',
                border: `1px solid ${isDark ? 'rgba(79,69,57,0.4)' : 'rgba(0,0,0,0.08)'}`,
                background: isDark ? 'rgba(30,28,26,0.6)' : 'rgba(255,255,255,0.5)',
                backdropFilter: 'blur(8px)',
                color: isDark ? 'rgba(237,224,212,0.9)' : 'rgba(0,0,0,0.75)',
                fontSize: '0.8125rem',
                outline: 'none',
                resize: 'none',
                lineHeight: 1.6,
                transition: `border 0.2s ${CUPERTINO}, box-shadow 0.2s ${CUPERTINO}`,
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(var(--pfc-accent-rgb), 0.4)';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(var(--pfc-accent-rgb), 0.08)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = isDark ? 'rgba(79,69,57,0.4)' : 'rgba(0,0,0,0.08)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </motion.div>

          {/* Checkboxes */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_SOFT, delay: 0.2 }}
            style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}
          >
            {[
              { key: 'hasTests', label: 'Has test suite' },
              { key: 'hasDocumentation', label: 'Has documentation' },
            ].map(({ key, label }) => (
              <label
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  color: isDark ? 'rgba(156,143,128,0.7)' : 'rgba(0,0,0,0.45)',
                }}
              >
                <motion.div
                  whileTap={{ scale: 0.85 }}
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    border: `1.5px solid ${
                      (input as Record<string, unknown>)[key]
                        ? 'var(--pfc-accent)'
                        : isDark ? 'rgba(79,69,57,0.5)' : 'rgba(0,0,0,0.15)'
                    }`,
                    background: (input as Record<string, unknown>)[key]
                      ? 'rgba(var(--pfc-accent-rgb), 0.2)'
                      : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: `all 0.15s ${CUPERTINO}`,
                    cursor: 'pointer',
                  }}
                  onClick={() => setInput(prev => ({ ...prev, [key]: !(prev as Record<string, unknown>)[key] }))}
                >
                  {Boolean((input as Record<string, unknown>)[key]) && (
                    <CheckCircle2Icon style={{ width: 10, height: 10, color: 'var(--pfc-accent)' }} />
                  )}
                </motion.div>
                <span onClick={() => setInput(prev => ({ ...prev, [key]: !(prev as Record<string, unknown>)[key] }))}>{label}</span>
              </label>
            ))}
          </motion.div>

          {/* Error + Submit */}
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                style={{ fontSize: '0.75rem', color: '#F87171' }}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_SOFT, delay: 0.25 }}
          >
            <GlassBubbleButton
              onClick={handleEvaluate}
              disabled={loading}
              color="ember"
              size="lg"
            >
              {loading ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                  >
                    <FlaskConicalIcon style={{ width: 16, height: 16 }} />
                  </motion.div>
                  Analyzing...
                </>
              ) : (
                <>
                  <SendIcon style={{ width: 14, height: 14 }} />
                  Run Evaluation
                </>
              )}
            </GlassBubbleButton>
          </motion.div>
        </div>
      </GlassSection>

      {/* ═══════════════════════════════════════════════════════
          Results
         ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {evaluation && (
          <motion.div
            ref={resultsRef}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ ...SPRING_SOFT, delay: 0.1 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}
          >
            {/* ── Hero Score Row ── */}
            <GlassSection title="Score Overview">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '1rem',
                }}
              >
                {/* Overall Score */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ ...SPRING_SNAPPY, delay: 0.15 }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '1.25rem 0.75rem',
                    borderRadius: '1rem',
                    background: isDark ? 'rgba(30,28,26,0.5)' : 'rgba(255,255,255,0.5)',
                    border: `1px solid ${isDark ? 'rgba(79,69,57,0.25)' : 'rgba(0,0,0,0.05)'}`,
                  }}
                >
                  <ScoreRing
                    value={evaluation.overallScore}
                    max={100}
                    size={72}
                    strokeWidth={5}
                    color={scoreColor(evaluation.overallScore / 100)}
                    isDark={isDark}
                  >
                    <span style={{ fontSize: '1.375rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: scoreColor(evaluation.overallScore / 100) }}>
                      {evaluation.overallScore}
                    </span>
                  </ScoreRing>
                  <span
                    style={{
                      fontSize: '0.5625rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.3)',
                      marginTop: '0.5rem',
                    }}
                  >
                    Overall Score
                  </span>
                  <span
                    style={{
                      marginTop: '0.25rem',
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      padding: '0.125rem 0.5rem',
                      borderRadius: '9999px',
                      background: `${gradeAccent(evaluation.overallGrade)}15`,
                      color: gradeAccent(evaluation.overallGrade),
                      border: `1px solid ${gradeAccent(evaluation.overallGrade)}25`,
                    }}
                  >
                    Grade {evaluation.overallGrade}
                  </span>
                </motion.div>

                {/* Project IQ */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ ...SPRING_SNAPPY, delay: 0.2 }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '1.25rem 0.75rem',
                    borderRadius: '1rem',
                    background: isDark ? 'rgba(30,28,26,0.5)' : 'rgba(255,255,255,0.5)',
                    border: `1px solid ${isDark ? 'rgba(79,69,57,0.25)' : 'rgba(0,0,0,0.05)'}`,
                  }}
                >
                  <ScoreRing
                    value={evaluation.intelligenceQuotient}
                    max={150}
                    size={72}
                    strokeWidth={5}
                    color="var(--pfc-accent)"
                    isDark={isDark}
                  >
                    <span style={{ fontSize: '1.375rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--pfc-accent)' }}>
                      {evaluation.intelligenceQuotient}
                    </span>
                  </ScoreRing>
                  <span style={{ fontSize: '0.5625rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.3)', marginTop: '0.5rem' }}>
                    Project IQ
                  </span>
                  <span style={{ fontSize: '0.625rem', color: isDark ? 'rgba(156,143,128,0.4)' : 'rgba(0,0,0,0.25)', marginTop: '0.25rem' }}>
                    of 150
                  </span>
                </motion.div>

                {/* Maturity */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ ...SPRING_SNAPPY, delay: 0.25 }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1.25rem 0.75rem',
                    borderRadius: '1rem',
                    background: isDark ? 'rgba(30,28,26,0.5)' : 'rgba(255,255,255,0.5)',
                    border: `1px solid ${isDark ? 'rgba(79,69,57,0.25)' : 'rgba(0,0,0,0.05)'}`,
                  }}
                >
                  <span
                    style={{
                      fontSize: '1.125rem',
                      fontWeight: 700,
                      textTransform: 'capitalize',
                      color: '#22D3EE',
                    }}
                  >
                    {evaluation.maturityLevel}
                  </span>
                  <span style={{ fontSize: '0.5625rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.3)', marginTop: '0.375rem' }}>
                    Maturity Level
                  </span>
                  <span
                    style={{
                      marginTop: '0.375rem',
                      fontSize: '0.625rem',
                      fontWeight: 600,
                      padding: '0.125rem 0.5rem',
                      borderRadius: '9999px',
                      background: isDark ? 'rgba(34,211,238,0.08)' : 'rgba(34,211,238,0.06)',
                      color: '#22D3EE',
                      border: `1px solid rgba(34,211,238,0.15)`,
                    }}
                  >
                    P{evaluation.industryPercentile} Percentile
                  </span>
                </motion.div>

                {/* Deploy Ready */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ ...SPRING_SNAPPY, delay: 0.3 }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '1.25rem 0.75rem',
                    borderRadius: '1rem',
                    background: isDark ? 'rgba(30,28,26,0.5)' : 'rgba(255,255,255,0.5)',
                    border: `1px solid ${isDark ? 'rgba(79,69,57,0.25)' : 'rgba(0,0,0,0.05)'}`,
                  }}
                >
                  <ScoreRing
                    value={evaluation.readinessScore}
                    max={1}
                    size={72}
                    strokeWidth={5}
                    color={scoreColor(evaluation.readinessScore)}
                    isDark={isDark}
                  >
                    <span style={{ fontSize: '1.375rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: scoreColor(evaluation.readinessScore) }}>
                      {Math.round(evaluation.readinessScore * 100)}%
                    </span>
                  </ScoreRing>
                  <span style={{ fontSize: '0.5625rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.3)', marginTop: '0.5rem' }}>
                    Deploy Ready
                  </span>
                  <span style={{ fontSize: '0.625rem', color: isDark ? 'rgba(156,143,128,0.4)' : 'rgba(0,0,0,0.25)', marginTop: '0.25rem' }}>
                    Tech debt: {Math.round(evaluation.technicalDebt * 100)}%
                  </span>
                </motion.div>
              </div>
            </GlassSection>

            {/* ── 12-Dimension Assessment ── */}
            <GlassSection title="12-Dimension Assessment">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {evaluation.dimensions.map((dim, i) => (
                  <DimensionRow key={dim.dimension} dim={dim} index={i} isDark={isDark} />
                ))}
              </div>
            </GlassSection>

            {/* ── Robustness & Calibration (side by side) ── */}
            <GlassSection title="Robustness & Calibration">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {/* Robustness */}
                <div
                  style={{
                    borderRadius: '0.75rem',
                    border: `1px solid ${isDark ? 'rgba(79,69,57,0.25)' : 'rgba(0,0,0,0.05)'}`,
                    padding: '1rem',
                    background: isDark ? 'rgba(30,28,26,0.4)' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <ShieldCheckIcon style={{ width: 14, height: 14, color: 'var(--pfc-accent)' }} />
                    <span style={{ fontSize: '0.8125rem', fontWeight: 650, color: isDark ? 'rgba(237,224,212,0.85)' : 'rgba(0,0,0,0.7)' }}>
                      Robustness Profile
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <MetricBar label="Perturbation Resistance" value={1 - evaluation.robustness.perturbationSensitivity} isDark={isDark} />
                    <MetricBar label="Distribution Shift Resilience" value={evaluation.robustness.distributionShiftResilience} isDark={isDark} />
                    <MetricBar label="Adversarial Resistance" value={evaluation.robustness.adversarialResistance} isDark={isDark} />
                    <MetricBar label="Edge Case Coverage" value={evaluation.robustness.edgeCaseCoverage} isDark={isDark} />
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        paddingTop: '0.5rem',
                        borderTop: `1px solid ${isDark ? 'rgba(79,69,57,0.2)' : 'rgba(0,0,0,0.04)'}`,
                      }}
                    >
                      <span style={{ fontSize: '0.6875rem', color: isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.35)' }}>
                        Graceful Failure:
                      </span>
                      <span
                        style={{
                          fontSize: '0.625rem',
                          fontWeight: 600,
                          padding: '0.0625rem 0.375rem',
                          borderRadius: '9999px',
                          background: evaluation.robustness.failureGracefully ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
                          color: evaluation.robustness.failureGracefully ? '#34D399' : '#F87171',
                          border: `1px solid ${evaluation.robustness.failureGracefully ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'}`,
                        }}
                      >
                        {evaluation.robustness.failureGracefully ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Calibration */}
                <div
                  style={{
                    borderRadius: '0.75rem',
                    border: `1px solid ${isDark ? 'rgba(79,69,57,0.25)' : 'rgba(0,0,0,0.05)'}`,
                    padding: '1rem',
                    background: isDark ? 'rgba(30,28,26,0.4)' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <GaugeIcon style={{ width: 14, height: 14, color: 'var(--pfc-accent)' }} />
                    <span style={{ fontSize: '0.8125rem', fontWeight: 650, color: isDark ? 'rgba(237,224,212,0.85)' : 'rgba(0,0,0,0.7)' }}>
                      Calibration Profile
                    </span>
                  </div>

                  {/* ECE + Brier */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
                    <div>
                      <span style={{ fontSize: '0.5625rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.3)' }}>
                        ECE
                      </span>
                      <p style={{ fontSize: '1.25rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--pfc-accent)', marginTop: 2 }}>
                        {evaluation.calibration.expectedCalibrationError.toFixed(3)}
                      </p>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.5625rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.3)' }}>
                        Brier Score
                      </span>
                      <p style={{ fontSize: '1.25rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: '#22D3EE', marginTop: 2 }}>
                        {evaluation.calibration.brierScore.toFixed(3)}
                      </p>
                    </div>
                  </div>

                  <div style={{ borderTop: `1px solid ${isDark ? 'rgba(79,69,57,0.2)' : 'rgba(0,0,0,0.04)'}`, paddingTop: '0.75rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
                      <div>
                        <span style={{ fontSize: '0.5625rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.3)' }}>
                          Overconfidence
                        </span>
                        <p style={{
                          fontSize: '1rem',
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                          color: evaluation.calibration.overconfidenceIndex > 0.2 ? '#F87171' : '#34D399',
                          marginTop: 2,
                        }}>
                          {(evaluation.calibration.overconfidenceIndex * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.5625rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.3)' }}>
                          Underconfidence
                        </span>
                        <p style={{ fontSize: '1rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#FBBF24', marginTop: 2 }}>
                          {(evaluation.calibration.underconfidenceIndex * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '0.5rem', borderTop: `1px solid ${isDark ? 'rgba(79,69,57,0.15)' : 'rgba(0,0,0,0.03)'}` }}>
                      <span style={{ fontSize: '0.6875rem', color: isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.35)' }}>
                        Reliability:
                      </span>
                      <span
                        style={{
                          fontSize: '0.625rem',
                          fontWeight: 600,
                          padding: '0.0625rem 0.375rem',
                          borderRadius: '9999px',
                          textTransform: 'capitalize',
                          background: isDark ? 'rgba(var(--pfc-accent-rgb), 0.08)' : 'rgba(var(--pfc-accent-rgb), 0.06)',
                          color: 'var(--pfc-accent)',
                          border: '1px solid rgba(var(--pfc-accent-rgb), 0.15)',
                        }}
                      >
                        {evaluation.calibration.reliabilityDiagramShape.replace(/-/g, ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </GlassSection>

            {/* ── Pattern Analysis ── */}
            <GlassSection title="Pattern Analysis">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                {/* Anti-patterns */}
                <div
                  style={{
                    borderRadius: '0.75rem',
                    border: `1px solid ${evaluation.patternAnalysis.antiPatterns.length > 0 ? 'rgba(248,113,113,0.2)' : isDark ? 'rgba(79,69,57,0.25)' : 'rgba(0,0,0,0.05)'}`,
                    padding: '1rem',
                    background: isDark ? 'rgba(30,28,26,0.4)' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.75rem' }}>
                    <AlertTriangleIcon style={{ width: 13, height: 13, color: '#F87171' }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 650, color: isDark ? 'rgba(237,224,212,0.8)' : 'rgba(0,0,0,0.65)' }}>
                      Anti-Patterns
                    </span>
                  </div>
                  {evaluation.patternAnalysis.antiPatterns.length === 0 ? (
                    <p style={{ fontSize: '0.6875rem', color: '#34D399', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <CheckCircle2Icon style={{ width: 11, height: 11 }} /> None detected
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {evaluation.patternAnalysis.antiPatterns.map((ap, i) => (
                        <div
                          key={i}
                          style={{
                            borderRadius: '0.5rem',
                            padding: '0.5rem',
                            background: 'rgba(248,113,113,0.04)',
                            border: '1px solid rgba(248,113,113,0.1)',
                          }}
                        >
                          <p style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#F87171' }}>{ap.name}</p>
                          <p style={{ fontSize: '0.625rem', color: isDark ? 'rgba(237,224,212,0.45)' : 'rgba(0,0,0,0.35)', marginTop: 2 }}>{ap.impact}</p>
                          <p style={{ fontSize: '0.625rem', color: 'var(--pfc-accent)', marginTop: 3 }}>Fix: {ap.fix}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Best Practices */}
                <div
                  style={{
                    borderRadius: '0.75rem',
                    border: `1px solid ${isDark ? 'rgba(79,69,57,0.25)' : 'rgba(0,0,0,0.05)'}`,
                    padding: '1rem',
                    background: isDark ? 'rgba(30,28,26,0.4)' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.75rem' }}>
                    <CheckCircle2Icon style={{ width: 13, height: 13, color: '#34D399' }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 650, color: isDark ? 'rgba(237,224,212,0.8)' : 'rgba(0,0,0,0.65)' }}>
                      Best Practices
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    {evaluation.patternAnalysis.bestPractices.map((bp, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        {bp.implemented ? (
                          <CheckCircle2Icon style={{ width: 11, height: 11, color: '#34D399', flexShrink: 0 }} />
                        ) : (
                          <div
                            style={{
                              width: 11,
                              height: 11,
                              borderRadius: '50%',
                              border: `1.5px solid ${isDark ? 'rgba(156,143,128,0.3)' : 'rgba(0,0,0,0.15)'}`,
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            color: bp.implemented
                              ? (isDark ? 'rgba(237,224,212,0.7)' : 'rgba(0,0,0,0.6)')
                              : (isDark ? 'rgba(156,143,128,0.45)' : 'rgba(0,0,0,0.3)'),
                          }}
                        >
                          {bp.name}
                        </span>
                        {bp.importance === 'essential' && !bp.implemented && (
                          <span
                            style={{
                              fontSize: '0.5rem',
                              fontWeight: 700,
                              padding: '0 0.25rem',
                              borderRadius: '9999px',
                              background: 'rgba(248,113,113,0.1)',
                              color: '#F87171',
                              border: '1px solid rgba(248,113,113,0.15)',
                            }}
                          >
                            !
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Innovation */}
                <div
                  style={{
                    borderRadius: '0.75rem',
                    border: `1px solid ${isDark ? 'rgba(79,69,57,0.25)' : 'rgba(0,0,0,0.05)'}`,
                    padding: '1rem',
                    background: isDark ? 'rgba(30,28,26,0.4)' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.75rem' }}>
                    <SparklesIcon style={{ width: 13, height: 13, color: 'var(--pfc-accent)' }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 650, color: isDark ? 'rgba(237,224,212,0.8)' : 'rgba(0,0,0,0.65)' }}>
                      Innovation
                    </span>
                  </div>
                  {evaluation.patternAnalysis.innovativeApproaches.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {evaluation.patternAnalysis.innovativeApproaches.map((ia, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: '0.625rem',
                            fontWeight: 600,
                            padding: '0.125rem 0.5rem',
                            borderRadius: '9999px',
                            background: 'rgba(var(--pfc-accent-rgb), 0.08)',
                            color: 'var(--pfc-accent)',
                            border: '1px solid rgba(var(--pfc-accent-rgb), 0.15)',
                          }}
                        >
                          {ia}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.6875rem', color: isDark ? 'rgba(156,143,128,0.4)' : 'rgba(0,0,0,0.25)' }}>
                      No innovative approaches detected
                    </p>
                  )}

                  <div style={{ borderTop: `1px solid ${isDark ? 'rgba(79,69,57,0.2)' : 'rgba(0,0,0,0.04)'}`, marginTop: '0.75rem', paddingTop: '0.75rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <MetricBar label="Complexity" value={evaluation.patternAnalysis.complexityScore} isDark={isDark} />
                      <MetricBar label="Modularity" value={evaluation.patternAnalysis.modularityScore} isDark={isDark} />
                    </div>
                  </div>
                </div>
              </div>
            </GlassSection>

            {/* ── Improvement Roadmap ── */}
            <GlassSection title="Improvement Roadmap">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                {/* Critical Issues */}
                {evaluation.criticalIssues.length > 0 && (
                  <div
                    style={{
                      borderRadius: '0.75rem',
                      border: '1px solid rgba(248,113,113,0.2)',
                      padding: '1rem',
                      background: isDark ? 'rgba(30,28,26,0.4)' : 'rgba(255,255,255,0.4)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.75rem' }}>
                      <ZapIcon style={{ width: 13, height: 13, color: '#F87171' }} />
                      <span style={{ fontSize: '0.75rem', fontWeight: 650, color: '#F87171' }}>
                        Critical Issues
                      </span>
                    </div>
                    {evaluation.criticalIssues.map((issue, i) => (
                      <p key={i} style={{ fontSize: '0.6875rem', color: isDark ? 'rgba(237,224,212,0.55)' : 'rgba(0,0,0,0.45)', marginBottom: '0.375rem', lineHeight: 1.5 }}>
                        {issue}
                      </p>
                    ))}
                  </div>
                )}

                {/* Quick Wins */}
                <div
                  style={{
                    borderRadius: '0.75rem',
                    border: `1px solid ${isDark ? 'rgba(var(--pfc-accent-rgb), 0.15)' : 'rgba(var(--pfc-accent-rgb), 0.1)'}`,
                    padding: '1rem',
                    background: isDark ? 'rgba(30,28,26,0.4)' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.75rem' }}>
                    <TrendingUpIcon style={{ width: 13, height: 13, color: 'var(--pfc-accent)' }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 650, color: 'var(--pfc-accent)' }}>
                      Quick Wins
                    </span>
                  </div>
                  {evaluation.quickWins.length > 0 ? (
                    evaluation.quickWins.map((qw, i) => (
                      <p key={i} style={{ fontSize: '0.6875rem', color: isDark ? 'rgba(237,224,212,0.55)' : 'rgba(0,0,0,0.45)', marginBottom: '0.375rem', lineHeight: 1.5 }}>
                        {qw}
                      </p>
                    ))
                  ) : (
                    <p style={{ fontSize: '0.6875rem', color: '#34D399' }}>Solid foundation</p>
                  )}
                </div>

                {/* Long-Term */}
                <div
                  style={{
                    borderRadius: '0.75rem',
                    border: `1px solid ${isDark ? 'rgba(79,69,57,0.25)' : 'rgba(0,0,0,0.05)'}`,
                    padding: '1rem',
                    background: isDark ? 'rgba(30,28,26,0.4)' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.75rem' }}>
                    <BookOpenIcon style={{ width: 13, height: 13, color: 'var(--pfc-accent)' }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 650, color: isDark ? 'rgba(237,224,212,0.8)' : 'rgba(0,0,0,0.65)' }}>
                      Long-Term
                    </span>
                  </div>
                  {evaluation.longTermRecommendations.length > 0 ? (
                    evaluation.longTermRecommendations.map((rec, i) => (
                      <p key={i} style={{ fontSize: '0.6875rem', color: isDark ? 'rgba(237,224,212,0.55)' : 'rgba(0,0,0,0.45)', marginBottom: '0.375rem', lineHeight: 1.5 }}>
                        {rec}
                      </p>
                    ))
                  ) : (
                    <p style={{ fontSize: '0.6875rem', color: '#34D399' }}>Excellent long-term positioning</p>
                  )}
                </div>
              </div>
            </GlassSection>

            {/* ── Comparable Benchmarks ── */}
            <GlassSection>
              <span style={{ fontSize: '0.5625rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.3)', display: 'block', marginBottom: '0.5rem' }}>
                Comparable Benchmarks
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                {evaluation.comparableProjects.map((cp, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: '0.625rem',
                      fontWeight: 600,
                      padding: '0.125rem 0.5rem',
                      borderRadius: '9999px',
                      background: isDark ? 'rgba(79,69,57,0.15)' : 'rgba(0,0,0,0.04)',
                      color: isDark ? 'rgba(156,143,128,0.6)' : 'rgba(0,0,0,0.4)',
                      border: `1px solid ${isDark ? 'rgba(79,69,57,0.2)' : 'rgba(0,0,0,0.06)'}`,
                    }}
                  >
                    {cp}
                  </span>
                ))}
              </div>
            </GlassSection>
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}
