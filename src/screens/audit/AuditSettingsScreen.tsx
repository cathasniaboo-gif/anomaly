import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Screen, SectionTitle } from '../../components/UI';
import { getAuditBackendUrl, setAuditBackendUrl, getAdminApiKey, setAdminApiKey } from '../../services/auditSettings';
import { listRules } from '../../services/auditApi';
import { colors } from '../../theme/theme';

type TestState = 'idle' | 'testing' | 'ok' | 'fail';

export default function AuditSettingsScreen() {
  const [backendUrl, setBackendUrl] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [testState, setTestState] = useState<TestState>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      setBackendUrl(await getAuditBackendUrl());
      setAdminKey(await getAdminApiKey());
      setLoaded(true);
    })();
  }, []);

  const save = async () => {
    await setAuditBackendUrl(backendUrl);
    await setAdminApiKey(adminKey);
    setSaved(true);
    setTestState('idle');
    setTimeout(() => setSaved(false), 2000);
  };

  const test = async () => {
    await setAuditBackendUrl(backendUrl);
    await setAdminApiKey(adminKey);
    setTestState('testing');
    try {
      await listRules();
      setTestState('ok');
      setTestMessage('Connected — the audit backend is reachable and the admin key is valid.');
    } catch (err) {
      setTestState('fail');
      setTestMessage(err instanceof Error ? err.message : 'Could not reach the backend.');
    }
  };

  if (!loaded) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator color={colors.teal} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={styles.hero}>
          The audit backend serves ledger scrutiny over an admin-key-gated API — financial data
          never sits behind the app's public endpoints. Both values below are stored only on this
          device.
        </Text>

        <SectionTitle>Backend URL</SectionTitle>
        <TextInput
          style={styles.input}
          placeholder="https://your-backend.example.com"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          value={backendUrl}
          onChangeText={setBackendUrl}
        />

        <View style={{ height: 18 }} />

        <SectionTitle>Admin API key</SectionTitle>
        <TextInput
          style={styles.input}
          placeholder="Paste the ADMIN_API_KEY set on the backend"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          value={adminKey}
          onChangeText={setAdminKey}
        />

        <View style={styles.btnRow}>
          <Pressable style={styles.saveBtn} onPress={save}>
            <Text style={styles.saveBtnText}>{saved ? 'Saved ✓' : 'Save'}</Text>
          </Pressable>
          <Pressable style={styles.testBtn} onPress={test} disabled={testState === 'testing'}>
            {testState === 'testing' ? (
              <ActivityIndicator color={colors.teal} size="small" />
            ) : (
              <Text style={styles.testBtnText}>Test connection</Text>
            )}
          </Pressable>
        </View>

        {testState === 'ok' && (
          <View style={styles.resultRow}>
            <MaterialCommunityIcons name="check-circle-outline" size={18} color={colors.teal} />
            <Text style={styles.resultTextOk}>{testMessage}</Text>
          </View>
        )}
        {testState === 'fail' && (
          <View style={styles.resultRow}>
            <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.resultTextFail}>{testMessage}</Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  hero: { fontSize: 13, color: colors.textSecondary, marginBottom: 20, lineHeight: 19 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: colors.ink,
  },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  saveBtn: { flex: 1, backgroundColor: colors.teal, paddingVertical: 12, alignItems: 'center' },
  saveBtnText: { color: colors.white, fontWeight: '600', fontSize: 13.5 },
  testBtn: { flex: 1, backgroundColor: colors.tealTint, paddingVertical: 12, alignItems: 'center' },
  testBtnText: { color: colors.teal, fontWeight: '600', fontSize: 13.5 },
  resultRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 14 },
  resultTextOk: { flex: 1, color: colors.teal, fontSize: 12.5, lineHeight: 18 },
  resultTextFail: { flex: 1, color: colors.danger, fontSize: 12.5, lineHeight: 18 },
});
