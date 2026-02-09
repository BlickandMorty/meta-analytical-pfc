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

  const bg = isDark ? 'rgba(196,149,106,0.06)' : 'rgba(0,0,0,0.04)';
  const hoverBg = isDark ? 'rgba(196,149,106,0.1)' : 'rgba(0,0,0,0.07)';
  const textColor = isDark ? 'rgba(155,150,137,0.9)' : 'rgba(0,0,0,0.45)';

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
        gap: '0.5rem',
        justifyContent: 'center',
        flexWrap: 'wrap',
      }}>
        {FEATURES.map((feat, i) => {
          const Icon = feat.icon;
          return (
            <motion.button
              key={feat.action}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.22 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => handleClick(feat.action)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.4375rem 0.875rem',
                borderRadius: '9999px',
                border: 'none',
                background: bg,
                color: textColor,
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '-0.01em',
                backdropFilter: 'blur(12px) saturate(1.3)',
                WebkitBackdropFilter: 'blur(12px) saturate(1.3)',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              <Icon style={{ height: '0.875rem', width: '0.875rem', flexShrink: 0 }} />
              {feat.label}
            </motion.button>
          );
        })}
      </div>
    </>
  );
});
