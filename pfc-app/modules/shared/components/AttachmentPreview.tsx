import React from 'react';
import { View, StyleSheet, Pressable, Image } from 'react-native';
import { useTheme } from '../theme';
import { PFCText } from './PFCText';
import { usePFCStore } from '../../store/usePFCStore';
import type { FileAttachment } from '../../engine/types';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function fileIcon(type: FileAttachment['type']): string {
  switch (type) {
    case 'image': return '\u{1F5BC}';
    case 'pdf': return '\u{1F4C4}';
    case 'csv': return '\u{1F4CA}';
    case 'text': return '\u{1F4DD}';
    default: return '\u{1F4CE}';
  }
}

export function AttachmentPreview() {
  const { colors } = useTheme();
  const pendingAttachments = usePFCStore((s) => s.pendingAttachments);
  const removeAttachment = usePFCStore((s) => s.removeAttachment);

  if (pendingAttachments.length === 0) return null;

  return (
    <View style={[styles.container, { borderTopColor: colors.border }]}>
      {pendingAttachments.map((file) => (
        <View
          key={file.id}
          style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          {file.type === 'image' && file.preview ? (
            <Image source={{ uri: file.preview }} style={styles.thumbnail} />
          ) : (
            <PFCText variant="code" size="sm" color={colors.textSecondary}>
              {fileIcon(file.type)}
            </PFCText>
          )}

          <View style={styles.chipInfo}>
            <PFCText variant="ui" size="xs" color={colors.textPrimary} style={{ maxWidth: 100 }}>
              {file.name.length > 15 ? file.name.slice(0, 12) + '...' : file.name}
            </PFCText>
            <PFCText variant="code" size="xs" color={colors.textTertiary}>
              {formatSize(file.size)}
            </PFCText>
          </View>

          <Pressable
            onPress={() => removeAttachment(file.id)}
            hitSlop={4}
            style={[styles.removeBtn, { backgroundColor: colors.backgroundTertiary }]}
          >
            <PFCText variant="ui" size="xs" color={colors.textTertiary}>
              {'\u2715'}
            </PFCText>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopWidth: 0.5,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipInfo: {
    gap: 1,
  },
  thumbnail: {
    width: 28,
    height: 28,
    borderRadius: 4,
  },
  removeBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
});
