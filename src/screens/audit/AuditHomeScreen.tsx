import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuditStackParamList } from '../../navigation/types';
import { Screen, EmptyState } from '../../components/UI';
import { FindingCountsRow, SOURCE_LABEL, formatDateShort } from '../../components/AuditUI';
import { listLedgers, AuditNotConfiguredError } from '../../services/auditApi';
import { isAuditConfigured } from '../../services/auditSettings';
import { LedgerListItem } from '../../types/audit';
import { colors, fonts } from '../../theme/theme';

type Props = NativeStackScreenProps<AuditStackParamList, 'AuditHome'>;

export default function AuditHomeScreen({ navigation }: Props) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [ledgers, setLedgers] = useState<LedgerListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const ok = await isAuditConfigured();
    setConfigured(ok);
    if (!ok) return;
    setLoading(true);
    try {
      setLedgers(await listLedgers());
    } catch (err) {
      if (!(err instanceof AuditNotConfiguredError)) {
        setError(err instanceof Error ? err.message : 'Could not load ledgers.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('AuditSettings')} hitSlop={10} style={{ padding: 4 }}>
          <MaterialCommunityIcons name="cog-outline" size={22} color="#fff" />
        </Pressable>
      ),
    });
  }, [navigation]);

  if (configured === false) {
    return (
      <Screen style={{ padding: 16 }}>
        <View style={styles.setupCard}>
          <MaterialCommunityIcons name="shield-search" size={32} color={colors.teal} />
          <Text style={styles.setupTitle}>Connect this app to your audit backend</Text>
          <Text style={styles.setupBody}>
            Ledger scrutiny needs a backend URL and admin key so imported financial data stays
            behind a credential, not bundled into the app.
          </Text>
          <Pressable style={styles.setupBtn} onPress={() => navigation.navigate('AuditSettings')}>
            <Text style={styles.setupBtnText}>Set up now</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={ledgers}
        keyExtractor={(l) => l.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.teal} />}
        ListHeaderComponent={
          <View>
            <Text style={styles.hero}>
              Import a ledger export or connect an accounting package, and every transaction gets
              run through the scrutiny engine automatically — balance checks, duplicates, outliers,
              Benford's Law and more.
            </Text>
            <View style={styles.actionRow}>
              <Pressable style={styles.actionBtn} onPress={() => navigation.navigate('ImportLedger')}>
                <MaterialCommunityIcons name="file-upload-outline" size={18} color={colors.white} />
                <Text style={styles.actionBtnText}>Import ledger</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, styles.actionBtnSecondary]}
                onPress={() => navigation.navigate('ConnectAccounting')}
              >
                <MaterialCommunityIcons name="link-variant" size={18} color={colors.teal} />
                <Text style={[styles.actionBtnText, { color: colors.teal }]}>Connect software</Text>
              </Pressable>
            </View>
            {error && <Text style={styles.error}>{error}</Text>}
            {loading && !ledgers.length && <ActivityIndicator style={{ marginTop: 20 }} color={colors.teal} />}
          </View>
        }
        ListEmptyComponent={
          !loading ? <EmptyState label="No ledgers yet. Import a CSV or connect an accounting package to get started." /> : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('LedgerDetail', { ledgerId: item.id, ledgerName: item.name })}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
          >
            <View style={styles.cardTopRow}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.name}
              </Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.goldDeep} />
            </View>
            <Text style={styles.cardMeta}>
              {SOURCE_LABEL[item.source]} · {item.summary.entryCount} entries · {formatDateShort(item.importedAt)}
              {!item.summary.balanced ? ' · Unbalanced' : ''}
            </Text>
            <View style={{ marginTop: 8 }}>
              <FindingCountsRow counts={item.summary.findingCounts} />
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { fontSize: 13, color: colors.textSecondary, marginBottom: 14, lineHeight: 19 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.teal,
    paddingVertical: 12,
  },
  actionBtnSecondary: { backgroundColor: colors.tealTint },
  actionBtnText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 12.5, marginBottom: 10 },
  card: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.ink },
  cardMeta: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
  setupCard: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  setupTitle: { fontFamily: fonts.serif, fontSize: 17, color: colors.ink, textAlign: 'center' },
  setupBody: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  setupBtn: { marginTop: 8, backgroundColor: colors.teal, paddingVertical: 11, paddingHorizontal: 20 },
  setupBtnText: { color: colors.white, fontWeight: '600', fontSize: 13.5 },
});
