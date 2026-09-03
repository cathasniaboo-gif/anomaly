import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuditStackParamList } from '../../navigation/types';
import { Screen, StatCard, EmptyState } from '../../components/UI';
import { SeverityPill, SOURCE_LABEL, formatCurrency, formatDateShort } from '../../components/AuditUI';
import { getLedger, rescanLedger, deleteLedger } from '../../services/auditApi';
import { Finding, LedgerRecord } from '../../types/audit';
import { colors } from '../../theme/theme';

type Props = NativeStackScreenProps<AuditStackParamList, 'LedgerDetail'>;

const SEVERITY_ORDER: Record<Finding['severity'], number> = { high: 0, medium: 1, low: 2 };

export default function LedgerDetailScreen({ route, navigation }: Props) {
  const { ledgerId, ledgerName } = route.params;
  const [ledger, setLedger] = useState<LedgerRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLedger(await getLedger(ledgerId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this ledger.');
    } finally {
      setLoading(false);
    }
  }, [ledgerId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const rescan = async () => {
    setBusy(true);
    try {
      setLedger(await rescanLedger(ledgerId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rescan failed.');
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    Alert.alert('Delete ledger?', `This removes "${ledgerName}" and its scrutiny findings. This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteLedger(ledgerId);
            navigation.goBack();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Delete failed.');
            setBusy(false);
          }
        },
      },
    ]);
  };

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: ledgerName,
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Pressable onPress={rescan} hitSlop={10} disabled={busy}>
            <MaterialCommunityIcons name="refresh" size={21} color="#fff" />
          </Pressable>
          <Pressable onPress={remove} hitSlop={10} disabled={busy}>
            <MaterialCommunityIcons name="trash-can-outline" size={20} color="#fff" />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, busy, ledger]);

  if (loading && !ledger) {
    return (
      <Screen style={{ alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.teal} />
      </Screen>
    );
  }

  if (error && !ledger) {
    return (
      <Screen style={{ padding: 16 }}>
        <Text style={{ color: colors.danger, fontSize: 13.5 }}>{error}</Text>
      </Screen>
    );
  }

  if (!ledger) return null;

  const findings = [...ledger.findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const entriesById = new Map(ledger.entries.map((e) => [e.id, e]));

  return (
    <Screen>
      <FlatList
        data={findings}
        keyExtractor={(f) => f.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListHeaderComponent={
          <View>
            <Text style={styles.meta}>
              {SOURCE_LABEL[ledger.source]} · imported {formatDateShort(ledger.importedAt)}
            </Text>
            <View style={styles.statsGrid}>
              <StatCard n={String(ledger.summary.entryCount)} label="Entries" />
              <StatCard n={formatCurrency(ledger.summary.totalDebit, ledger.entries[0]?.currency ?? '')} label="Total debit" />
              <StatCard n={formatCurrency(ledger.summary.totalCredit, ledger.entries[0]?.currency ?? '')} label="Total credit" />
              <StatCard
                n={ledger.summary.balanced ? 'Balanced' : formatCurrency(Math.abs(ledger.summary.imbalance), ledger.entries[0]?.currency ?? '')}
                label={ledger.summary.balanced ? 'Balance' : 'Out of balance'}
              />
            </View>
            <Text style={styles.sectionHeader}>
              Findings {findings.length ? `(${findings.length})` : ''}
            </Text>
          </View>
        }
        ListEmptyComponent={<EmptyState label="No findings — this ledger is clean." />}
        renderItem={({ item }) => {
          const entries = item.entryIds.map((id) => entriesById.get(id)).filter((e): e is NonNullable<typeof e> => !!e);
          return (
            <Pressable
              style={({ pressed }) => [styles.findingCard, pressed && { opacity: 0.7 }]}
              onPress={() => navigation.navigate('FindingDetail', { finding: item, entries })}
            >
              <View style={styles.findingTopRow}>
                <SeverityPill severity={item.severity} />
                {item.entryIds.length > 0 && <Text style={styles.findingCount}>{item.entryIds.length} entries</Text>}
              </View>
              <Text style={styles.findingTitle}>{item.title}</Text>
              <Text style={styles.findingDesc} numberOfLines={2}>
                {item.description}
              </Text>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: { fontSize: 12, color: colors.textSecondary, marginBottom: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  sectionHeader: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: colors.textSecondary, fontWeight: '600', marginBottom: 10 },
  findingCard: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 },
  findingTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  findingCount: { fontSize: 11, color: colors.textSecondary },
  findingTitle: { fontSize: 14.5, fontWeight: '600', color: colors.ink, marginBottom: 4 },
  findingDesc: { fontSize: 12.5, color: colors.inkSoft, lineHeight: 18 },
});
