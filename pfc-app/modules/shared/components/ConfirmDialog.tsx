import React from 'react';
import { View, Modal, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../theme';
import { PFCText } from './PFCText';
import { PFCButton } from './PFCButton';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable
          style={[styles.dialog, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <PFCText variant="display" size="lg" color={colors.semantic.error} center>
            {title}
          </PFCText>

          <PFCText
            variant="body"
            size="sm"
            color={colors.textSecondary}
            center
            style={{ marginTop: 12 }}
          >
            {message}
          </PFCText>

          <View style={styles.actions}>
            <PFCButton
              label={cancelLabel}
              onPress={onCancel}
              variant="ghost"
              size="sm"
              style={{ flex: 1 }}
            />
            <PFCButton
              label={confirmLabel}
              onPress={onConfirm}
              variant="danger"
              size="sm"
              style={{ flex: 1 }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  dialog: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
});
