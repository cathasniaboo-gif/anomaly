import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/theme';
import { FindingSeverity, LedgerSource } from '../types/audit';

export const SEVERITY_COLOR: Record<FindingSeverity, string> = {
  high: colors.danger,
  medium: colors.gold,
  low: colors.textSecondary,
};

export const SEVERITY_LABEL: Record<FindingSeverity, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const SOURCE_LABEL: Record<LedgerSource, string> = {
  import: 'Manual import',
  quickbooks: 'QuickBooks Online',
  xero: 'Xero',
};

export function formatCurrency(n: number, currency: string): string {
  const formatted = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency} ${formatted}`;
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function SeverityPill({ severity }: { severity: FindingSeverity }) {
  return (
    <View style={[styles.pill, { backgroundColor: SEVERITY_COLOR[severity] + '22' }]}>
      <Text style={[styles.pillText, { color: SEVERITY_COLOR[severity] }]}>{SEVERITY_LABEL[severity]}</Text>
    </View>
  );
}

export function FindingCountsRow({ counts }: { counts: Record<FindingSeverity, number> }) {
  const order: FindingSeverity[] = ['high', 'medium', 'low'];
  const total = counts.high + counts.medium + counts.low;
  if (total === 0) {
    return (
      <View style={styles.cleanRow}>
        <Text style={styles.cleanText}>No findings</Text>
      </View>
    );
  }
  return (
    <View style={styles.countsRow}>
      {order
        .filter((sev) => counts[sev] > 0)
        .map((sev) => (
          <View key={sev} style={[styles.countChip, { borderColor: SEVERITY_COLOR[sev] }]}>
            <Text style={[styles.countChipText, { color: SEVERITY_COLOR[sev] }]}>
              {counts[sev]} {SEVERITY_LABEL[sev]}
            </Text>
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 3 },
  pillText: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.3 },
  countsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  countChip: { borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 3 },
  countChipText: { fontSize: 11, fontWeight: '600' },
  cleanRow: { alignSelf: 'flex-start', backgroundColor: colors.tealTint, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 3 },
  cleanText: { fontSize: 11, color: colors.teal, fontWeight: '600' },
});
