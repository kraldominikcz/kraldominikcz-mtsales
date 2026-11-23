import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, font, MAX_CONTENT_WIDTH, radius, spacing } from './theme';

export function Screen({ children, centered }: { children: ReactNode; centered?: boolean }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, centered && styles.centered]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtitle({ children }: { children: ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

export function Body({ children, muted, mono }: { children: ReactNode; muted?: boolean; mono?: boolean }) {
  return <Text style={[styles.body, muted && styles.muted, mono && styles.mono]}>{children}</Text>;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Row({ children, wrap }: { children: ReactNode; wrap?: boolean }) {
  return <View style={[styles.row, wrap && { flexWrap: 'wrap' }]}>{children}</View>;
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button(props: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  const variant = props.variant ?? 'primary';
  const disabled = props.disabled || props.loading;
  return (
    <Pressable
      testID={props.testID}
      accessibilityRole="button"
      onPress={props.onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        styles[`button_${variant}`],
        pressed && { opacity: 0.8 },
        disabled && { opacity: 0.5 },
      ]}
    >
      {props.loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? colors.primaryText : colors.primary} />
      ) : (
        <Text style={[styles.buttonText, styles[`buttonText_${variant}`]]}>{props.title}</Text>
      )}
    </Pressable>
  );
}

export function TextField(props: TextInputProps & { label: string; error?: string | null }) {
  const { label, error, style, ...rest } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...rest}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function Chip(props: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: Boolean(props.selected) }}
      onPress={props.onPress}
      style={[styles.chip, props.selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, props.selected && styles.chipTextSelected]}>{props.label}</Text>
    </Pressable>
  );
}

export function Banner({ kind, children }: { kind: 'error' | 'success' | 'info'; children: ReactNode }) {
  const bg = kind === 'error' ? colors.dangerBg : kind === 'success' ? colors.successBg : colors.warningBg;
  const fg = kind === 'error' ? colors.danger : kind === 'success' ? colors.success : colors.text;
  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: font.md }}>{children}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, padding: spacing.lg },
  centered: { justifyContent: 'center' },
  content: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', gap: spacing.md },
  title: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: font.lg, fontWeight: '600', color: colors.text, marginTop: spacing.sm },
  body: { fontSize: font.md, color: colors.text, lineHeight: 21 },
  muted: { color: colors.textMuted },
  mono: { fontFamily: 'Courier', fontSize: font.lg, letterSpacing: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  button: {
    minHeight: 46,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button_primary: { backgroundColor: colors.primary },
  button_secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary },
  button_danger: { backgroundColor: colors.danger },
  button_ghost: { backgroundColor: 'transparent' },
  buttonText: { fontSize: font.md, fontWeight: '600' },
  buttonText_primary: { color: colors.primaryText },
  buttonText_secondary: { color: colors.primary },
  buttonText_danger: { color: colors.primaryText },
  buttonText_ghost: { color: colors.accent },
  field: { gap: spacing.xs },
  label: { fontSize: font.sm, color: colors.textMuted, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: font.md,
    color: colors.text,
  },
  inputError: { borderColor: colors.danger },
  fieldError: { color: colors.danger, fontSize: font.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: font.sm },
  chipTextSelected: { color: colors.primaryText, fontWeight: '600' },
  banner: { padding: spacing.md, borderRadius: radius.md },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
