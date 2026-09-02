import React, { useMemo, useState } from 'react';
import { View, TextInput, FlatList, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HomeStackParamList } from '../navigation/types';
import { KNOWLEDGE_BASE } from '../data/knowledgeBase';
import { Screen, QuestionRow, EmptyState } from '../components/UI';
import { colors } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'Search'>;

export default function SearchScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const terms = q.split(/\s+/).filter(Boolean);
    return KNOWLEDGE_BASE.filter((d) => {
      const hay = `${d.q} ${d.a} ${d.cat}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [query]);

  return (
    <Screen>
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <View style={styles.searchRow}>
          <MaterialCommunityIcons name="magnify" size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.input}
            placeholder="Search e.g. QFZP, VAT, IFRS 18…"
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCorrect={false}
          />
        </View>
      </View>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListEmptyComponent={
          <EmptyState label={query.trim() ? 'No matches. Try a shorter term.' : 'Type to search across every topic.'} />
        }
        renderItem={({ item }) => (
          <QuestionRow
            question={item.q}
            catLabel={item.cat}
            onPress={() => navigation.navigate('Detail', { item })}
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.panel,
    borderWidth: 1.5,
    borderColor: colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  input: { flex: 1, fontSize: 15, color: colors.ink, paddingVertical: 4 },
});
