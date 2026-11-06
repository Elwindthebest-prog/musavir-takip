import { ReactNode } from 'react';
import {
  Pressable, ScrollView, StyleProp, StyleSheet, Switch, Text, TextInput, TextInputProps, View, ViewStyle,
} from 'react-native';
import { useStore } from '@/lib/store';
import { daysLeft, periodLabel, shiftPeriod } from '@/lib/tax';
import { STATUS_LABEL, TaskStatus } from '@/lib/types';

export const C = {
  bg: '#F4F6FA',
  card: '#FFFFFF',
  text: '#1B2430',
  muted: '#6B7686',
  border: '#E2E7EF',
  primary: '#2457D6',
  primarySoft: '#E7EEFF',
  green: '#16884A',
  greenSoft: '#E3F5EA',
  amber: '#B26A00',
  amberSoft: '#FFF2DB',
  red: '#C62B2B',
  redSoft: '#FDE7E7',
  graySoft: '#EEF1F5',
};

export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={s.screen}>
      <View style={s.inner}>{children}</View>
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Title({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={s.titleRow}>
      <Text style={s.title}>{children}</Text>
      {right}
    </View>
  );
}

export function Muted({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[s.muted, style]}>{children}</Text>;
}

type BtnKind = 'primary' | 'soft' | 'danger' | 'ghost';
export function Button({
  label, onPress, kind = 'primary', small, style,
}: { label: string; onPress: () => void; kind?: BtnKind; small?: boolean; style?: StyleProp<ViewStyle> }) {
  const bg = { primary: C.primary, soft: C.primarySoft, danger: C.redSoft, ghost: 'transparent' }[kind];
  const fg = { primary: '#fff', soft: C.primary, danger: C.red, ghost: C.primary }[kind];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [s.btn, small && s.btnSmall, { backgroundColor: bg, opacity: pressed ? 0.7 : 1 }, style]}
    >
      <Text style={[s.btnText, small && { fontSize: 14 }, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput placeholderTextColor="#9AA4B2" style={[s.input, props.multiline && { minHeight: 80 }]} {...props} />
    </View>
  );
}

export function ToggleRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!value)} style={s.toggleRow} accessibilityRole="switch" accessibilityState={{ checked: value }}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowText}>{label}</Text>
        {hint ? <Muted>{hint}</Muted> : null}
      </View>
      {/* Dokunmayı satır yakalar; Switch yalnızca görseldir (çift tetiklenmeyi önler) */}
      <View pointerEvents="none">
        <Switch value={value} trackColor={{ true: C.primary, false: '#CBD2DC' }} />
      </View>
    </Pressable>
  );
}

export function Segment<T extends string>({
  label, value, options, onChange,
}: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      <View style={s.segment}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable key={o.value} onPress={() => onChange(o.value)} style={[s.segItem, on && s.segOn]}>
              <Text style={[s.segText, on && { color: '#fff' }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function PeriodBar() {
  const { period, setPeriod } = useStore();
  return (
    <View style={s.periodBar}>
      <Pressable onPress={() => setPeriod(shiftPeriod(period, -1))} style={s.periodBtn} accessibilityLabel="Önceki dönem">
        <Text style={s.periodArrow}>‹</Text>
      </Pressable>
      <View style={{ alignItems: 'center' }}>
        <Muted>Dönem</Muted>
        <Text style={s.periodText}>{periodLabel(period)}</Text>
      </View>
      <Pressable onPress={() => setPeriod(shiftPeriod(period, 1))} style={s.periodBtn} accessibilityLabel="Sonraki dönem">
        <Text style={s.periodArrow}>›</Text>
      </Pressable>
    </View>
  );
}

export function StatusChip({ status, deadline, onPress }: { status: TaskStatus; deadline?: Date; onPress?: () => void }) {
  const late = status !== 'verildi' && deadline && daysLeft(deadline) < 0;
  const [bg, fg] = status === 'verildi'
    ? [C.greenSoft, C.green]
    : late ? [C.redSoft, C.red]
      : status === 'hazirlaniyor' ? [C.amberSoft, C.amber] : [C.graySoft, C.muted];
  const icon = status === 'verildi' ? '✓ ' : status === 'hazirlaniyor' ? '◐ ' : '○ ';
  return (
    <Pressable onPress={onPress} disabled={!onPress} hitSlop={6} style={[s.chip, { backgroundColor: bg }]}>
      <Text style={[s.chipText, { color: fg }]}>{icon}{STATUS_LABEL[status]}</Text>
    </Pressable>
  );
}

export function Badge({ text, color = C.muted, bg = C.graySoft }: { text: string; color?: string; bg?: string }) {
  return (
    <View style={[s.chip, { backgroundColor: bg }]}>
      <Text style={[s.chipText, { color }]}>{text}</Text>
    </View>
  );
}

export function Stat({ value, label, tone = 'normal', onPress }: { value: string | number; label: string; tone?: 'normal' | 'red' | 'amber' | 'green'; onPress?: () => void }) {
  const fg = { normal: C.text, red: C.red, amber: C.amber, green: C.green }[tone];
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={s.stat}>
      <Text style={[s.statValue, { color: fg }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </Pressable>
  );
}

export function Empty({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
      <Muted style={{ textAlign: 'center', marginBottom: action ? 14 : 0 }}>{text}</Muted>
      {action}
    </Card>
  );
}

export const s = StyleSheet.create({
  screen: { padding: 16, paddingBottom: 40 },
  inner: { width: '100%', maxWidth: 820, alignSelf: 'center' },
  card: {
    backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: C.border,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 10 },
  title: { fontSize: 18, fontWeight: '700', color: C.text },
  muted: { color: C.muted, fontSize: 13 },
  label: { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 16, color: C.text, backgroundColor: '#fff',
  },
  btn: { paddingVertical: 13, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnSmall: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  btnText: { fontSize: 16, fontWeight: '700' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  rowText: { fontSize: 16, color: C.text },
  segment: { flexDirection: 'row', backgroundColor: C.graySoft, borderRadius: 10, padding: 3 },
  segItem: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  segOn: { backgroundColor: C.primary },
  segText: { fontSize: 14, fontWeight: '600', color: C.text },
  periodBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.card,
    borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 6, marginBottom: 12,
  },
  periodBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: C.primarySoft },
  periodArrow: { fontSize: 28, color: C.primary, fontWeight: '700', marginTop: -3 },
  periodText: { fontSize: 18, fontWeight: '700', color: C.text },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, alignSelf: 'flex-start' },
  chipText: { fontSize: 13, fontWeight: '700' },
  stat: {
    flexGrow: 1, flexBasis: '45%', backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 14,
  },
  statValue: { fontSize: 26, fontWeight: '800' },
  statLabel: { fontSize: 13, color: C.muted, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, gap: 10 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: C.text },
});
