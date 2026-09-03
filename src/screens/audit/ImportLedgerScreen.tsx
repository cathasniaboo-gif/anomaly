import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuditStackParamList } from '../../navigation/types';
import { Screen, SectionTitle } from '../../components/UI';
import { importLedgerCsv } from '../../services/auditApi';
import { colors } from '../../theme/theme';

type Props = NativeStackScreenProps<AuditStackParamList, 'ImportLedger'>;

export default function ImportLedgerScreen({ navigation }: Props) {
  const [fileName, setFileName] = useState('');
  const [csvText, setCsvText] = useState('');
  const [ledgerName, setLedgerName] = useState('');
  const [rowCount, setRowCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickFile = async () => {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', '*/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    try {
      const text = await (await fetch(asset.uri)).text();
      setFileName(asset.name ?? 'ledger.csv');
      setCsvText(text);
      setRowCount(Math.max(0, text.trim().split(/\r?\n/).length - 1));
      if (!ledgerName) setLedgerName((asset.name ?? 'Imported ledger').replace(/\.csv$/i, ''));
    } catch (err) {
      setError(err instanceof Error ? `Could not read that file: ${err.message}` : 'Could not read that file.');
    }
  };

  const submit = async () => {
    if (!csvText) return;
    setBusy(true);
    setError(null);
    try {
      const record = await importLedgerCsv(ledgerName || fileName || 'Imported ledger', csvText);
      navigation.replace('LedgerDetail', { ledgerId: record.id, ledgerName: record.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={styles.hero}>
          Pick a CSV export from your accounting software or spreadsheet. Column headers like
          "Date", "Account", "Debit/Credit" (or a single "Amount") and "Reference" are detected
          automatically — see the backend README for the exact aliases recognised.
        </Text>

        <Pressable style={styles.pickBtn} onPress={pickFile}>
          <MaterialCommunityIcons name="file-upload-outline" size={20} color={colors.teal} />
          <Text style={styles.pickBtnText}>{fileName ? 'Choose a different file' : 'Choose CSV file'}</Text>
        </Pressable>

        {!!fileName && (
          <View style={styles.fileInfo}>
            <MaterialCommunityIcons name="file-check-outline" size={16} color={colors.teal} />
            <Text style={styles.fileInfoText}>
              {fileName} · {rowCount} row{rowCount === 1 ? '' : 's'} detected
            </Text>
          </View>
        )}

        <View style={{ height: 18 }} />
        <SectionTitle>Ledger name</SectionTitle>
        <TextInput
          style={styles.input}
          placeholder="e.g. Q1 2026 general ledger"
          placeholderTextColor={colors.textSecondary}
          value={ledgerName}
          onChangeText={setLedgerName}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.submitBtn, (!csvText || busy) && styles.submitBtnDisabled]}
          onPress={submit}
          disabled={!csvText || busy}
        >
          {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitBtnText}>Import &amp; scrutinize</Text>}
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { fontSize: 13, color: colors.textSecondary, marginBottom: 18, lineHeight: 19 },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.teal,
    borderStyle: 'dashed',
    paddingVertical: 18,
    backgroundColor: colors.tealTint,
  },
  pickBtnText: { color: colors.teal, fontWeight: '600', fontSize: 14 },
  fileInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  fileInfoText: { fontSize: 12.5, color: colors.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: colors.ink,
  },
  error: { color: colors.danger, fontSize: 12.5, marginTop: 14 },
  submitBtn: { marginTop: 22, backgroundColor: colors.teal, paddingVertical: 14, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: colors.white, fontWeight: '600', fontSize: 14.5 },
});
