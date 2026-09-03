import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuditStackParamList } from '../../navigation/types';
import { Screen } from '../../components/UI';
import { listConnectors, getConnectorAuthUrl, syncConnector, disconnectConnector } from '../../services/auditApi';
import { ConnectorInfo } from '../../types/audit';
import { colors } from '../../theme/theme';

type Props = NativeStackScreenProps<AuditStackParamList, 'ConnectAccounting'>;

export default function ConnectAccountingScreen({ navigation }: Props) {
  const [connectors, setConnectors] = useState<ConnectorInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setConnectors(await listConnectors());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load connectors.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const connect = async (c: ConnectorInfo) => {
    if (!c.configured) {
      Alert.alert(
        `${c.name} not configured`,
        `The backend doesn't have ${c.name} client credentials set yet — see backend/src/audit/connectors/README.md.`
      );
      return;
    }
    setBusyId(c.id);
    setError(null);
    try {
      const { url } = await getConnectorAuthUrl(c.id);
      // The provider's OAuth redirect lands on the backend (not the app —
      // see backend/src/audit/routes.ts), which shows a plain "Connected"
      // page. Closing that browser tab and coming back here refreshes the
      // connector list to pick up the new connection.
      await WebBrowser.openBrowserAsync(url);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not start the ${c.name} connection.`);
    } finally {
      setBusyId(null);
    }
  };

  const sync = async (c: ConnectorInfo) => {
    setBusyId(c.id);
    setError(null);
    try {
      const record = await syncConnector(c.id);
      navigation.navigate('LedgerDetail', { ledgerId: record.id, ledgerName: record.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not sync ${c.name}.`);
    } finally {
      setBusyId(null);
    }
  };

  const disconnect = (c: ConnectorInfo) => {
    Alert.alert(`Disconnect ${c.name}?`, 'You can reconnect it again at any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          setBusyId(c.id);
          try {
            await disconnectConnector(c.id);
            await load();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not disconnect.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={styles.hero}>
          Connect an accounting package to pull its general ledger straight into scrutiny — each
          sync creates a fresh snapshot so you can compare runs over time.
        </Text>

        {error && <Text style={styles.error}>{error}</Text>}
        {loading && !connectors.length && <ActivityIndicator color={colors.teal} style={{ marginTop: 20 }} />}

        {connectors.map((c) => (
          <View key={c.id} style={styles.card}>
            <View style={styles.cardTopRow}>
              <MaterialCommunityIcons
                name={c.id === 'quickbooks' ? 'file-document-outline' : 'chart-line'}
                size={22}
                color={colors.teal}
              />
              <Text style={styles.cardTitle}>{c.name}</Text>
              {c.connected && (
                <View style={styles.connectedPill}>
                  <Text style={styles.connectedPillText}>Connected</Text>
                </View>
              )}
            </View>
            {c.connected && c.companyName && <Text style={styles.cardMeta}>{c.companyName}</Text>}
            {!c.configured && <Text style={styles.cardMetaWarn}>Not configured on this backend yet</Text>}

            <View style={styles.btnRow}>
              {busyId === c.id ? (
                <ActivityIndicator color={colors.teal} />
              ) : c.connected ? (
                <>
                  <Pressable style={styles.primaryBtn} onPress={() => sync(c)}>
                    <Text style={styles.primaryBtnText}>Sync now</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryBtn} onPress={() => disconnect(c)}>
                    <Text style={styles.secondaryBtnText}>Disconnect</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable style={styles.primaryBtn} onPress={() => connect(c)}>
                  <Text style={styles.primaryBtnText}>Connect</Text>
                </Pressable>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { fontSize: 13, color: colors.textSecondary, marginBottom: 18, lineHeight: 19 },
  error: { color: colors.danger, fontSize: 12.5, marginBottom: 12 },
  card: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.ink },
  cardMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  cardMetaWarn: { fontSize: 12, color: colors.danger, marginTop: 4 },
  connectedPill: { backgroundColor: colors.tealTint, paddingHorizontal: 8, paddingVertical: 3 },
  connectedPillText: { fontSize: 10.5, color: colors.teal, fontWeight: '700' },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  primaryBtn: { backgroundColor: colors.teal, paddingVertical: 10, paddingHorizontal: 16 },
  primaryBtnText: { color: colors.white, fontWeight: '600', fontSize: 13 },
  secondaryBtn: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, paddingVertical: 10, paddingHorizontal: 16 },
  secondaryBtnText: { color: colors.danger, fontWeight: '600', fontSize: 13 },
});
