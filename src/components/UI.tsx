import React from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle, StyleProp } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts } from '../theme/theme';

export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function HeroLine({ children }: { children: React.ReactNode }) {
  return <Text style={styles.heroLine}>{children}</Text>;
}

export function EmptyState({ label }: { label: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{label}</Text>
    </View>
  );
}

export function CategoryRow({
  name,
  count,
  icon,
  onPress,
}: {
  name: string;
  count: number;
  icon: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.catRow, pressed && styles.pressed]}
    >
      <View style={styles.catIconWrap}>
        <MaterialCommunityIcons name={icon as any} size={19} color={colors.teal} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.catName}>{name}</Text>
        <Text style={styles.catCount}>{count} {count === 1 ? 'entry' : 'entries'}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.goldDeep} />
    </Pressable>
  );
}

export function QuestionRow({
  question,
  catLabel,
  onPress,
}: {
  question: string;
  catLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.qRow, pressed && styles.pressed]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.qText}>{question}</Text>
        <Text style={styles.qCat}>{catLabel}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.goldDeep} />
    </Pressable>
  );
}

export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{children}</Text>
    </View>
  );
}

export function StatCard({ n, label }: { n: string; label: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statN}>{n}</Text>
      <Text style={styles.statL}>{label}</Text>
    </View>
  );
}

export function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  sectionTitle: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.textSecondary,
    marginBottom: 10,
    fontWeight: '600',
  },
  heroLine: { fontSize: 13, color: colors.textSecondary, marginBottom: 16, lineHeight: 19 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  pressed: { opacity: 0.6 },
  catIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.tealTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catName: { fontSize: 14.5, fontWeight: '600', color: colors.ink },
  catCount: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  qRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  qText: { fontSize: 14.5, fontWeight: '500', color: colors.ink, lineHeight: 20 },
  qCat: { fontSize: 11, color: colors.teal, marginTop: 3 },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.tealTint,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginBottom: 14,
  },
  pillText: { fontSize: 11, color: colors.teal, fontWeight: '600' },
  statCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  statN: { fontSize: 20, color: colors.teal, fontFamily: fonts.serif },
  statL: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: colors.white, fontSize: 9.5, fontWeight: '700' },
});
