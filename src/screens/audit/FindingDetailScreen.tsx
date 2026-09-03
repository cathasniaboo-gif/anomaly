import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuditStackParamList } from '../../navigation/types';
import { Screen, EmptyState } from '../../components/UI';
import { SeverityPill, formatCurrency, formatDateShort } from '../../components/AuditUI';
import { colors } from '../../theme/theme';

type Props = NativeStackScreenProps<AuditStackParamList, 'FindingDetail'>;

export default function FindingDetailScreen({ route, navigation }: Props) {
  const { finding, entries } = route.params;

  React.useLayoutEffect(() => {
    navigation.setOptions({ title: finding.title });
  }, [navigation, finding.title]);

  return (
    <Screen>
      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={styles.header}>
            <SeverityPill severity={finding.severity} />
            <Text style={styles.description}>{finding.description}</Text>
            {entries.length > 0 && (
              <Text style={styles.sectionHeader}>
                {entries.length} related entr{entries.length === 1 ? 'y' : 'ies'}
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={<EmptyState label="This finding is about the ledger as a whole, not specific entries." />}
        renderItem={({ item }) => (
          <View style={styles.entryCard}>
            <View style={styles.entryTopRow}>
              <Text style={styles.entryAccount} numberOfLines={1}>
                {item.account || '(no account)'}
              </Text>
              <Text style={styles.entryDate}>{formatDateShort(item.date)}</Text>
            </View>
            <Text style={styles.entryDesc}>{item.description || '(no description)'}</Text>
            <View style={styles.entryBottomRow}>
              {item.reference ? <Text style={styles.entryRef}>Ref {item.reference}</Text> : <View />}
              <Text style={styles.entryAmount}>
                {item.debit > 0 ? `Dr ${formatCurrency(item.debit, item.currency)}` : `Cr ${formatCurrency(item.credit, item.currency)}`}
              </Text>
            </View>
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 8 },
  description: { fontSize: 13.5, color: colors.inkSoft, lineHeight: 20, marginTop: 10 },
  sectionHeader: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.textSecondary,
    fontWeight: '600',
    marginTop: 18,
    marginBottom: 4,
  },
  entryCard: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 8 },
  entryTopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  entryAccount: { flex: 1, fontSize: 13.5, fontWeight: '600', color: colors.ink },
  entryDate: { fontSize: 11.5, color: colors.textSecondary },
  entryDesc: { fontSize: 12.5, color: colors.inkSoft, marginTop: 3, marginBottom: 8 },
  entryBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entryRef: { fontSize: 11, color: colors.textSecondary },
  entryAmount: { fontSize: 13, fontWeight: '600', color: colors.teal },
});
