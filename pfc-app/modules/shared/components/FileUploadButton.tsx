import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Alert, Platform, ActionSheetIOS } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../theme';
import { PFCText } from './PFCText';
import { usePFCStore } from '../../store/usePFCStore';
import type { FileAttachment } from '../../engine/types';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function generateId(): string {
  return `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function detectFileType(mimeType: string): FileAttachment['type'] {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'text/csv' || mimeType.includes('spreadsheet') || mimeType.includes('csv')) return 'csv';
  if (mimeType.startsWith('text/')) return 'text';
  return 'other';
}

interface FileUploadButtonProps {
  disabled?: boolean;
}

export function FileUploadButton({ disabled }: FileUploadButtonProps) {
  const { colors } = useTheme();
  const addAttachment = usePFCStore((s) => s.addAttachment);

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const size = asset.fileSize ?? 0;

      if (size > MAX_FILE_SIZE) {
        Alert.alert('File too large', 'Maximum file size is 10MB');
        return;
      }

      const attachment: FileAttachment = {
        id: generateId(),
        name: asset.fileName ?? 'image.jpg',
        type: 'image',
        uri: asset.uri,
        size,
        mimeType: asset.mimeType ?? 'image/jpeg',
        preview: asset.uri, // use URI directly for image previews
      };

      addAttachment(attachment);
    } catch (err) {
      console.warn('Image picker error:', err);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/csv', 'text/plain', 'application/json', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const size = asset.size ?? 0;

      if (size > MAX_FILE_SIZE) {
        Alert.alert('File too large', 'Maximum file size is 10MB');
        return;
      }

      const attachment: FileAttachment = {
        id: generateId(),
        name: asset.name,
        type: detectFileType(asset.mimeType ?? ''),
        uri: asset.uri,
        size,
        mimeType: asset.mimeType ?? 'application/octet-stream',
      };

      addAttachment(attachment);
    } catch (err) {
      console.warn('Document picker error:', err);
    }
  };

  const showOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Photo Library', 'Document'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) handlePickImage();
          if (buttonIndex === 2) handlePickDocument();
        },
      );
    } else {
      // On web/Android, show a simple alert-based picker
      Alert.alert('Attach File', 'Choose source', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Photo Library', onPress: handlePickImage },
        { text: 'Document', onPress: handlePickDocument },
      ]);
    }
  };

  return (
    <Pressable
      onPress={showOptions}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: pressed ? colors.brand.primary + '15' : 'transparent',
          borderColor: colors.border,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <PFCText variant="ui" size="lg" color={colors.textTertiary}>
        +
      </PFCText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
