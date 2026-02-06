import React, { useState, useCallback } from 'react';
import { View, StyleSheet, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../modules/shared/theme';
import { PFCText } from '../modules/shared/components/PFCText';
import { PFCButton } from '../modules/shared/components/PFCButton';
import { usePFCStore } from '../modules/store/usePFCStore';

type Phase = 'key' | 'mode';

export default function OnboardingScreen() {
  const router = useRouter();
  const { colors, fonts, fontSizes } = useTheme();
  const configure = usePFCStore((s) => s.configure);

  const [phase, setPhase] = useState<Phase>('key');
  const [keyInput, setKeyInput] = useState('');
  const [mode, setMode] = useState<'hybrid' | 'local'>('hybrid');

  const handleKeyConfirm = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('mode');
  }, []);

  const handleSkip = useCallback(() => {
    setKeyInput('');
    setMode('local');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPhase('mode');
  }, []);

  const handleDeploy = useCallback(() => {
    configure(keyInput.trim(), mode);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/(tabs)');
  }, [keyInput, mode, configure, router]);

  if (phase === 'key') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <PFCText variant="code" size="xs" color={colors.textTertiary}>
            {'>'} META-ANALYTICAL PFC v2.0
          </PFCText>
          <PFCText variant="code" size="xs" color={colors.textTertiary} style={{ marginTop: 2 }}>
            {'>'} INITIALIZATION PROTOCOL
          </PFCText>

          <PFCText
            variant="display"
            size="xl"
            color={colors.brand.primary}
            glow
            center
            style={{ marginTop: 40 }}
          >
            API Key
          </PFCText>
          <PFCText
            variant="ui"
            size="sm"
            color={colors.textSecondary}
            center
            style={{ marginTop: 8 }}
          >
            Enter your Anthropic API key for hybrid inference
          </PFCText>

          <TextInput
            style={[
              styles.keyInput,
              {
                borderColor: colors.brand.primary,
                color: colors.textPrimary,
                fontFamily: fonts.mono,
                fontSize: fontSizes.md,
                backgroundColor: colors.surface,
              },
            ]}
            value={keyInput}
            onChangeText={setKeyInput}
            placeholder="sk-ant-..."
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />

          <PFCButton
            label="Confirm"
            onPress={handleKeyConfirm}
            variant="primary"
            size="lg"
            disabled={!keyInput.trim()}
            style={{ marginTop: 24, alignSelf: 'stretch', marginHorizontal: 24 }}
          />

          <PFCButton
            label="Skip — Local Only"
            onPress={handleSkip}
            variant="ghost"
            size="sm"
            style={{ marginTop: 16 }}
          />

          <PFCText
            variant="body"
            size="xs"
            color={colors.textTertiary}
            center
            style={{ marginTop: 24, paddingHorizontal: 40 }}
          >
            Local mode uses open-weight models on your device. No API key needed, but requires model download.
          </PFCText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.centered}>
        <PFCText variant="code" size="xs" color={colors.textTertiary}>
          {'>'} API KEY — {keyInput ? 'SET' : 'SKIPPED'}
        </PFCText>

        <PFCText
          variant="display"
          size="xl"
          color={colors.brand.accent}
          glow
          center
          style={{ marginTop: 40 }}
        >
          Inference Mode
        </PFCText>
        <PFCText
          variant="ui"
          size="sm"
          color={colors.textSecondary}
          center
          style={{ marginTop: 8 }}
        >
          Choose how the PFC processes queries
        </PFCText>

        <View style={styles.modeList}>
          <Pressable
            style={[
              styles.modeCard,
              {
                borderColor: mode === 'hybrid' ? colors.brand.accent : colors.border,
                backgroundColor: mode === 'hybrid' ? colors.brand.accent + '10' : colors.surface,
                borderRadius: 12,
              },
            ]}
            onPress={() => {
              setMode('hybrid');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <PFCText variant="ui" size="lg" color={mode === 'hybrid' ? colors.brand.accent : colors.textSecondary}>
              Hybrid
            </PFCText>
            <PFCText variant="body" size="xs" color={colors.textSecondary} style={{ marginTop: 4 }}>
              Anthropic API for synthesis + local model for activations & TDA
            </PFCText>
            {!keyInput && (
              <PFCText variant="ui" size="xs" color={colors.semantic.warning} style={{ marginTop: 4 }}>
                Requires API key
              </PFCText>
            )}
          </Pressable>

          <Pressable
            style={[
              styles.modeCard,
              {
                borderColor: mode === 'local' ? colors.brand.accent : colors.border,
                backgroundColor: mode === 'local' ? colors.brand.accent + '10' : colors.surface,
                borderRadius: 12,
              },
            ]}
            onPress={() => {
              setMode('local');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <PFCText variant="ui" size="lg" color={mode === 'local' ? colors.brand.accent : colors.textSecondary}>
              Local
            </PFCText>
            <PFCText variant="body" size="xs" color={colors.textSecondary} style={{ marginTop: 4 }}>
              Open-weight model on your device. Full TDA. No API calls.
            </PFCText>
          </Pressable>
        </View>

        <PFCButton
          label="Deploy PFC"
          onPress={handleDeploy}
          variant="primary"
          size="lg"
          disabled={mode === 'hybrid' && !keyInput}
          style={{ marginTop: 32, alignSelf: 'stretch', marginHorizontal: 24 }}
        />

        <PFCButton
          label="Back"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setPhase('key');
          }}
          variant="ghost"
          size="sm"
          style={{ marginTop: 16 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  keyInput: {
    width: '85%',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    textAlign: 'center',
    marginTop: 24,
    letterSpacing: 1,
  },
  modeList: {
    width: '100%',
    marginTop: 24,
    gap: 12,
  },
  modeCard: {
    borderWidth: 1.5,
    padding: 16,
  },
});
