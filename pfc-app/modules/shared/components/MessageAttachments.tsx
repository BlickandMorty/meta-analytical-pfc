import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { useTheme } from '../theme';
import { PFCText } from './PFCText';
import type { FileAttachment } from '../../engine/types';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

interface MessageAttachmentsProps {
  attachments: FileAttachment[];
  isUser?: boolean;
}

export function MessageAttachments({ attachments, isUser = false }: MessageAttachmentsProps) {
  const { colors } = useTheme();

  if (!attachments || attachments.length === 0) return null;

  return (
    <View style={styles.container}>
      {attachments.map((file) => {
        if (file.type === 'image') {
          return (
            <View key={file.id} style={styles.imageWrap}>
              <Image
                source={{ uri: file.uri }}
                style={styles.image}
                resizeMode="cover"
              />
              <PFCText variant="code" size="xs" color={isUser ? colors.textInverse + '80' : colors.textTertiary}>
                {file.name}
              </PFCText>
            </View>
          );
        }

        // PDF / CSV / other files
        const icon = file.type === 'pdf' ? '\u{1F4C4}' :
                     file.type === 'csv' ? '\u{1F4CA}' :
                     file.type === 'text' ? '\u{1F4DD}' : '\u{1F4CE}';

        return (
          <View
            key={file.id}
            style={[
              styles.fileCard,
              {
                backgroundColor: isUser ? 'rgba(255,255,255,0.15)' : colors.backgroundTertiary,
                borderColor: isUser ? 'rgba(255,255,255,0.2)' : colors.border,
              },
            ]}
          >
            <PFCText variant="code" size="lg" color={isUser ? colors.textInverse : colors.textSecondary}>
              {icon}
            </PFCText>
            <View style={styles.fileInfo}>
              <PFCText variant="ui" size="xs" color={isUser ? colors.textInverse : colors.textPrimary}>
                {file.name}
              </PFCText>
              <PFCText variant="code" size="xs" color={isUser ? colors.textInverse + '80' : colors.textTertiary}>
                {file.type.toUpperCase()} · {formatSize(file.size)}
              </PFCText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
    marginTop: 6,
  },
  imageWrap: {
    gap: 2,
  },
  image: {
    width: '100%',
    height: 160,
    borderRadius: 8,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  fileInfo: {
    flex: 1,
    gap: 2,
  },
});
