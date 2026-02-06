import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Platform,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { usePFCStore } from '../modules/store/usePFCStore';

// ── Retro Terminal Palette ──────────────────────────────────────────
const T = {
  bg: '#1A0F0A',           // deep espresso
  panel: '#2A1D14',        // warm brown panel
  panelLight: '#3D2B1E',   // lighter brown for surfaces
  border: '#6B4226',       // copper border
  borderLight: '#8B5E3C',  // highlight edge (3D top/left)
  borderDark: '#3A2010',   // shadow edge (3D bottom/right)
  screen: '#0A1A1A',       // dark teal CRT screen
  screenBorder: '#4A7A6A', // teal frame
  green: '#33FF66',        // terminal green
  greenDim: '#1A8833',     // dimmer green
  greenGlow: '#33FF6640',  // green glow
  amber: '#FFAA33',        // amber/gold for prompts
  amberDim: '#AA7722',     // dim amber
  cyan: '#66FFEE',         // cyan for system
  cyanDim: '#338877',      // dim cyan
  red: '#FF4444',          // error red
  purple: '#7B5EA7',       // accent purple
  textMuted: '#6B6B5B',    // muted text
  white: '#E8E0D0',        // warm white
  buttonFace: '#8B6B4A',   // 3D button face
  buttonHi: '#B8956E',     // 3D button highlight
  buttonShadow: '#4A3520', // 3D button shadow
  buttonText: '#1A0F0A',   // button text (dark)
};

// ── Types ───────────────────────────────────────────────────────────
type TermLine = {
  id: number;
  text: string;
  color: string;
  isTyping?: boolean;
  delay?: number;
};

type SetupStep =
  | 'boot'
  | 'ask_setup'
  | 'setup_check'
  | 'ask_api'
  | 'api_input'
  | 'deploying'
  | 'done';

let lineId = 0;
const nextId = () => ++lineId;

// ── 3D Button Component ────────────────────────────────────────────
function RetroButton({
  label,
  onPress,
  color = T.buttonFace,
  textColor = T.buttonText,
  wide = false,
  small = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  color?: string;
  textColor?: string;
  wide?: boolean;
  small?: boolean;
  disabled?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  const pad = small ? 6 : 10;
  const padH = small ? 14 : wide ? 32 : 20;

  return (
    <Pressable
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={() => {
        if (disabled) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      disabled={disabled}
      style={[
        {
          borderWidth: 3,
          borderTopColor: pressed ? T.borderDark : T.buttonHi,
          borderLeftColor: pressed ? T.borderDark : T.buttonHi,
          borderBottomColor: pressed ? T.buttonHi : T.buttonShadow,
          borderRightColor: pressed ? T.buttonHi : T.buttonShadow,
          backgroundColor: pressed ? T.panelLight : color,
          paddingVertical: pad,
          paddingHorizontal: padH,
          opacity: disabled ? 0.4 : 1,
          transform: [{ translateY: pressed ? 2 : 0 }],
        },
        wide && { alignSelf: 'stretch' as const },
      ]}
    >
      <View
        style={{
          borderWidth: 1,
          borderTopColor: pressed ? 'transparent' : 'rgba(255,255,255,0.15)',
          borderLeftColor: pressed ? 'transparent' : 'rgba(255,255,255,0.1)',
          borderBottomColor: pressed ? 'transparent' : 'rgba(0,0,0,0.2)',
          borderRightColor: pressed ? 'transparent' : 'rgba(0,0,0,0.15)',
          paddingVertical: 2,
          paddingHorizontal: 4,
          alignItems: 'center',
        }}
      >
        <PixelText
          color={disabled ? T.textMuted : textColor}
          size={small ? 8 : 10}
        >
          {label}
        </PixelText>
      </View>
    </Pressable>
  );
}

// ── Pixel Text Shortcut ─────────────────────────────────────────────
function PixelText({
  children,
  color = T.green,
  size = 10,
  style,
  glow = false,
}: {
  children: React.ReactNode;
  color?: string;
  size?: number;
  style?: any;
  glow?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Animated.Text
        style={[
          {
            fontFamily: 'PressStart2P_400Regular',
            fontSize: size,
            color,
            letterSpacing: 0.5,
            lineHeight: size * 1.8,
          },
          glow && {
            textShadowColor: color + '80',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 8,
          },
          style,
        ]}
      >
        {children}
      </Animated.Text>
    </View>
  );
}

// ── Typing Line (appears char by char) ──────────────────────────────
function TypingLine({
  text,
  color,
  onDone,
  speed = 35,
}: {
  text: string;
  color: string;
  onDone?: () => void;
  speed?: number;
}) {
  const [len, setLen] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    setLen(0);
    doneRef.current = false;
    const iv = setInterval(() => {
      setLen((prev) => {
        const next = Math.min(prev + 1, text.length);
        if (next >= text.length && !doneRef.current) {
          doneRef.current = true;
          clearInterval(iv);
          setTimeout(() => onDone?.(), 80);
        }
        return next;
      });
    }, speed);
    return () => clearInterval(iv);
  }, [text, speed]);

  return (
    <PixelText color={color} size={9} glow>
      {text.slice(0, len)}
      {len < text.length ? '\u2588' : ''}
    </PixelText>
  );
}

// ════════════════════════════════════════════════════════════════════
// ██ MAIN ONBOARDING SCREEN
// ════════════════════════════════════════════════════════════════════
export default function OnboardingScreen() {
  const router = useRouter();
  const configure = usePFCStore((s) => s.configure);

  const [step, setStep] = useState<SetupStep>('boot');
  const [lines, setLines] = useState<TermLine[]>([]);
  const [typingDone, setTypingDone] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [showCursor, setShowCursor] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  // Blinking cursor
  useEffect(() => {
    const iv = setInterval(() => setShowCursor((c) => !c), 530);
    return () => clearInterval(iv);
  }, []);

  // Auto-scroll on new lines
  useEffect(() => {
    const t = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
    return () => clearTimeout(t);
  }, [lines, step]);

  // Add lines helper
  const addLines = useCallback((newLines: Omit<TermLine, 'id'>[]) => {
    setLines((prev) => [
      ...prev,
      ...newLines.map((l) => ({ ...l, id: nextId() })),
    ]);
  }, []);

  // ── Boot Sequence ─────────────────────────────────────────────
  useEffect(() => {
    const bootLines: Omit<TermLine, 'id'>[] = [
      { text: '╔══════════════════════════════════════╗', color: T.border },
      { text: '║  META-ANALYTICAL PFC v2.0            ║', color: T.amber },
      { text: '║  Initialization Terminal             ║', color: T.amberDim },
      { text: '╚══════════════════════════════════════╝', color: T.border },
      { text: '', color: T.green },
      { text: '> BIOS POST... OK', color: T.greenDim },
      { text: '> Loading reasoning modules...', color: T.greenDim },
      { text: '> TDA pipeline............ ready', color: T.green },
      { text: '> Bayesian engine......... ready', color: T.green },
      { text: '> Causal inference........ ready', color: T.green },
      { text: '> Meta-analysis core...... ready', color: T.green },
      { text: '> Adversarial review...... ready', color: T.green },
      { text: '', color: T.green },
    ];

    let i = 0;
    const addNext = () => {
      if (i < bootLines.length) {
        addLines([bootLines[i]]);
        i++;
        setTimeout(addNext, 60 + Math.random() * 40);
      } else {
        setTimeout(() => {
          addLines([
            { text: '> All core systems nominal.', color: T.cyan, isTyping: true },
          ]);
          setStep('ask_setup');
        }, 300);
      }
    };
    addNext();
  }, []);

  // ── Step: Ask Setup ───────────────────────────────────────────
  useEffect(() => {
    if (step !== 'ask_setup') return;
    const t = setTimeout(() => {
      addLines([
        { text: '', color: T.green },
        { text: '┌─────────────────────────────────────┐', color: T.amber },
        { text: '│ First time? Need to set things up?  │', color: T.amber },
        { text: '└─────────────────────────────────────┘', color: T.amber },
      ]);
      setTypingDone(true);
    }, 800);
    return () => clearTimeout(t);
  }, [step]);

  // ── Step: Setup Check (user said yes) ─────────────────────────
  useEffect(() => {
    if (step !== 'setup_check') return;
    setTypingDone(false);

    const checkLines: Omit<TermLine, 'id'>[] = [
      { text: '', color: T.green },
      { text: '> Checking dependencies...', color: T.cyan },
      { text: '  Python 3.10+......... [OK]', color: T.green },
      { text: '  Node.js 18+.......... [OK]', color: T.green },
      { text: '  PyTorch.............. [OK]', color: T.green },
      { text: '  Ripser (TDA)......... [OK]', color: T.green },
      { text: '  Local models dir..... [OK]', color: T.green },
      { text: '', color: T.green },
      { text: '> All dependencies satisfied.', color: T.cyan },
    ];

    let i = 0;
    const addNext = () => {
      if (i < checkLines.length) {
        addLines([checkLines[i]]);
        i++;
        setTimeout(addNext, 120 + Math.random() * 80);
      } else {
        setTimeout(() => {
          setStep('ask_api');
        }, 500);
      }
    };
    setTimeout(addNext, 400);
  }, [step]);

  // ── Step: Ask API Key ─────────────────────────────────────────
  useEffect(() => {
    if (step !== 'ask_api') return;
    const t = setTimeout(() => {
      addLines([
        { text: '', color: T.green },
        { text: '┌─────────────────────────────────────┐', color: T.amber },
        { text: '│ Enter Anthropic API key for hybrid  │', color: T.amber },
        { text: '│ inference, or skip for local-only.  │', color: T.amber },
        { text: '└─────────────────────────────────────┘', color: T.amber },
      ]);
      setTypingDone(true);
    }, 300);
    return () => clearTimeout(t);
  }, [step]);

  // ── Step: Deploying ───────────────────────────────────────────
  useEffect(() => {
    if (step !== 'deploying') return;
    setTypingDone(false);

    const deployLines: Omit<TermLine, 'id'>[] = [
      { text: '', color: T.green },
      { text: '> Initializing PFC cortex...', color: T.cyan },
      { text: '> Binding reasoning pathways...', color: T.cyan },
      { text: '> Calibrating confidence model...', color: T.cyan },
      { text: '> Loading topological analyzer...', color: T.cyan },
      { text: '', color: T.green },
      { text: '████████████████████████ 100%', color: T.green },
      { text: '', color: T.green },
      { text: '> SYSTEM READY. Deploying PFC...', color: T.amber },
    ];

    let i = 0;
    const addNext = () => {
      if (i < deployLines.length) {
        addLines([deployLines[i]]);
        i++;
        setTimeout(addNext, 150 + Math.random() * 100);
      } else {
        setTimeout(() => {
          setStep('done');
        }, 600);
      }
    };
    setTimeout(addNext, 300);
  }, [step]);

  // ── Step: Done → navigate ─────────────────────────────────────
  useEffect(() => {
    if (step !== 'done') return;
    const mode = keyInput.trim() ? 'hybrid' : 'local';
    configure(keyInput.trim(), mode);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const t = setTimeout(() => {
      router.replace('/(tabs)');
    }, 400);
    return () => clearTimeout(t);
  }, [step]);

  // ── Handlers ──────────────────────────────────────────────────
  const handleYes = useCallback(() => {
    setTypingDone(false);
    addLines([{ text: '> YES', color: T.white }]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep('setup_check');
  }, [addLines]);

  const handleNo = useCallback(() => {
    setTypingDone(false);
    addLines([{ text: '> NO — Skipping setup check.', color: T.white }]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setStep('ask_api'), 600);
  }, [addLines]);

  const handleApiConfirm = useCallback(() => {
    setTypingDone(false);
    addLines([{ text: `> API KEY: ${'*'.repeat(Math.min(keyInput.length, 20))}`, color: T.white }]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTimeout(() => setStep('deploying'), 400);
  }, [keyInput, addLines]);

  const handleSkipApi = useCallback(() => {
    setTypingDone(false);
    setKeyInput('');
    addLines([{ text: '> SKIP — Local inference only.', color: T.white }]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setStep('deploying'), 400);
  }, [addLines]);

  // ════════════════════════════════════════════════════════════════
  // ██ RENDER
  // ════════════════════════════════════════════════════════════════
  return (
    <View style={styles.root}>
      {/* Outer bezel */}
      <View style={styles.bezel}>
        {/* Screen area */}
        <View style={styles.screenOuter}>
          <View style={styles.screenInner}>
            {/* Scanlines overlay */}
            {Platform.OS === 'web' && (
              <View style={[StyleSheet.absoluteFill, styles.scanlines]} pointerEvents="none" />
            )}

            {/* Terminal output */}
            <ScrollView
              ref={scrollRef}
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {lines.map((line) => (
                <View key={line.id} style={styles.lineRow}>
                  {line.isTyping ? (
                    <TypingLine text={line.text} color={line.color} />
                  ) : (
                    <PixelText color={line.color} size={9} glow={line.color === T.green || line.color === T.cyan}>
                      {line.text}
                    </PixelText>
                  )}
                </View>
              ))}

              {/* Prompt cursor when idle */}
              {typingDone && step !== 'api_input' && step !== 'deploying' && step !== 'done' && (
                <View style={styles.lineRow}>
                  <PixelText color={T.green} size={9} glow>
                    {'>'} {showCursor ? '\u2588' : ' '}
                  </PixelText>
                </View>
              )}
            </ScrollView>
          </View>
        </View>

        {/* Control panel below screen */}
        <View style={styles.controlPanel}>
          {/* Title bar */}
          <View style={styles.titleBar}>
            <PixelText color={T.amber} size={8} glow>
              META-ANALYTICAL PFC
            </PixelText>
            <PixelText color={T.amberDim} size={7}>
              INIT TERMINAL
            </PixelText>
          </View>

          {/* Action area — changes based on step */}
          <View style={styles.actionArea}>
            {step === 'ask_setup' && typingDone && (
              <View style={styles.buttonRow}>
                <RetroButton
                  label="YES — CHECK SETUP"
                  onPress={handleYes}
                  color="#4A7A4A"
                  textColor={T.white}
                />
                <RetroButton
                  label="NO — SKIP"
                  onPress={handleNo}
                  color={T.buttonFace}
                  textColor={T.buttonText}
                />
              </View>
            )}

            {step === 'ask_api' && typingDone && (
              <View style={styles.apiSection}>
                <View style={styles.apiInputRow}>
                  <View style={styles.apiInputWrapper}>
                    <TextInput
                      style={styles.apiInput}
                      value={keyInput}
                      onChangeText={setKeyInput}
                      placeholder="sk-ant-..."
                      placeholderTextColor={T.textMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                      secureTextEntry
                    />
                  </View>
                </View>
                <View style={styles.buttonRow}>
                  <RetroButton
                    label="CONFIRM KEY"
                    onPress={handleApiConfirm}
                    color="#4A7A4A"
                    textColor={T.white}
                    disabled={!keyInput.trim()}
                  />
                  <RetroButton
                    label="SKIP — LOCAL"
                    onPress={handleSkipApi}
                    color="#7A5A3A"
                    textColor={T.white}
                  />
                </View>
              </View>
            )}

            {(step === 'boot' || step === 'setup_check' || step === 'deploying') && (
              <View style={styles.statusRow}>
                <View style={[styles.statusLed, { backgroundColor: T.green }]} />
                <PixelText color={T.greenDim} size={7}>
                  {step === 'boot'
                    ? 'BOOTING...'
                    : step === 'setup_check'
                    ? 'CHECKING...'
                    : 'DEPLOYING...'}
                </PixelText>
              </View>
            )}

            {step === 'done' && (
              <View style={styles.statusRow}>
                <View style={[styles.statusLed, { backgroundColor: T.amber }]} />
                <PixelText color={T.amber} size={7} glow>
                  SYSTEM READY
                </PixelText>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════
// ██ STYLES
// ════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },

  bezel: {
    width: '100%',
    maxWidth: 600,
    flex: 1,
    maxHeight: 800,
    backgroundColor: T.panel,
    borderWidth: 4,
    borderTopColor: T.borderLight,
    borderLeftColor: T.borderLight,
    borderBottomColor: T.borderDark,
    borderRightColor: T.borderDark,
    borderRadius: 4,
    padding: 12,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.6,
          shadowRadius: 16,
          elevation: 12,
        }),
  } as any,

  screenOuter: {
    flex: 1,
    borderWidth: 3,
    borderTopColor: T.borderDark,
    borderLeftColor: T.borderDark,
    borderBottomColor: T.borderLight,
    borderRightColor: T.borderLight,
    backgroundColor: T.screen,
    borderRadius: 2,
  },

  screenInner: {
    flex: 1,
    borderWidth: 1,
    borderColor: T.screenBorder + '40',
    margin: 2,
    overflow: 'hidden',
  },

  scanlines: {
    ...(Platform.OS === 'web'
      ? {
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,100,0.015) 2px, rgba(0,255,100,0.015) 4px)',
        }
      : {}),
  } as any,

  scrollArea: {
    flex: 1,
  },

  scrollContent: {
    padding: 12,
    paddingBottom: 24,
  },

  lineRow: {
    minHeight: 18,
    paddingVertical: 1,
  },

  controlPanel: {
    marginTop: 10,
    borderWidth: 2,
    borderTopColor: T.borderLight,
    borderLeftColor: T.borderLight,
    borderBottomColor: T.borderDark,
    borderRightColor: T.borderDark,
    backgroundColor: T.panelLight,
    borderRadius: 2,
    padding: 10,
  },

  titleBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: T.border,
    paddingBottom: 8,
    marginBottom: 10,
  },

  actionArea: {
    minHeight: 60,
    justifyContent: 'center',
  },

  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },

  apiSection: {
    gap: 12,
  },

  apiInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  apiInputWrapper: {
    flex: 1,
    borderWidth: 3,
    borderTopColor: T.borderDark,
    borderLeftColor: T.borderDark,
    borderBottomColor: T.borderLight,
    borderRightColor: T.borderLight,
    backgroundColor: T.screen,
    borderRadius: 2,
  },

  apiInput: {
    fontFamily: 'PressStart2P_400Regular',
    fontSize: 9,
    color: T.green,
    paddingVertical: 10,
    paddingHorizontal: 12,
    letterSpacing: 1,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 8,
  },

  statusLed: {
    width: 8,
    height: 8,
    borderRadius: 4,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 0 6px currentColor' }
      : {}),
  } as any,
});
