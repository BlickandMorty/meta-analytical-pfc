'use client';

import { useRef, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import {
  ImagePlusIcon,
  SparklesIcon,
  BookOpenIcon,
  FlaskConicalIcon,
} from 'lucide-react';
import { usePFCStore } from '@/lib/store/use-pfc-store';

/* Harmonoid spring for staggered entrance */
const BTN_SPRING = { type: 'spring' as const, stiffness: 400, damping: 30, mass: 0.6 };

interface FeatureButtonsProps {
  isDark: boolean;
  onSubmit: (query: string) => void;
}

interface FeatureBtn {
  icon: React.ElementType;
  label: string;
  action: 'upload' | 'deep-analysis' | 'literature' | 'hypothesis';
}

const FEATURES: FeatureBtn[] = [
  { icon: ImagePlusIcon, label: 'Upload File', action: 'upload' },
  { icon: SparklesIcon, label: 'Deep Analysis', action: 'deep-analysis' },
  { icon: BookOpenIcon, label: 'Literature Review', action: 'literature' },
  { icon: FlaskConicalIcon, label: 'Test Hypothesis', action: 'hypothesis' },
];

function fileTypeFromMime(mime: string): 'image' | 'csv' | 'pdf' | 'text' | 'other' {
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.includes('csv') || mime.includes('tab-separated')) return 'csv';
  if (mime.startsWith('text/')) return 'text';
  return 'other';
}

export const FeatureButtons = memo(function FeatureButtons({ isDark, onSubmit }: FeatureButtonsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addAttachment = usePFCStore((s) => s.addAttachment);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    reader.onload = () => {
      const uri = reader.result as string;
      const mimeType = file.type || 'application/octet-stream';

      addAttachment({
        id: crypto.randomUUID(),
        name: file.name,
        type: fileTypeFromMime(mimeType),
        uri,
        size: file.size,
        mimeType,
      });

      onSubmit(`Analyze this uploaded file: ${file.name}`);
    };

    reader.readAsDataURL(file);
    e.target.value = '';
  }, [onSubmit, addAttachment]);

  const handleClick = useCallback((action: string) => {
    switch (action) {
      case 'upload':
        fileInputRef.current?.click();
        break;
      case 'deep-analysis':
        onSubmit('Perform a deep meta-analytical review on the topic I will describe next');
        break;
      case 'literature':
        onSubmit('Conduct a systematic literature review with effect sizes and confidence intervals');
        break;
      case 'hypothesis':
        onSubmit('Help me formulate and test a research hypothesis using available evidence');
        break;
    }
  }, [onSubmit]);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.csv,.tsv,.json,.txt,.pdf,.xlsx,.xls,.doc,.docx"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <div style={{
        display: 'flex',
        gap: '0.375rem',
        justifyContent: 'center',
        flexWrap: 'wrap',
      }}>
        {FEATURES.map((feat, i) => {
          const Icon = feat.icon;
          return (
            <motion.button
              key={feat.action}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ ...BTN_SPRING, delay: i * 0.04 }}
              whileTap={{ scale: 0.94 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => handleClick(feat.action)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.375rem 0.75rem',
                borderRadius: 'var(--shape-full)',
                border: '1px solid var(--m3-outline-variant)',
                background: 'var(--m3-surface-container-high)',
                color: 'var(--m3-on-surface-variant)',
                cursor: 'pointer',
                fontSize: 'var(--type-label-lg)',
                fontWeight: 500,
                letterSpacing: '0.1px',
                transition: 'background 0.15s, color 0.15s, border-color 0.15s',
              }}
            >
              <Icon style={{ height: '0.8125rem', width: '0.8125rem', flexShrink: 0 }} />
              {feat.label}
            </motion.button>
          );
        })}
      </div>
    </>
  );
});
