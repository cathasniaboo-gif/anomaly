import React from 'react';
import { ScrollView, View, Text, Pressable, Linking, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { UpdatesStackParamList } from '../navigation/types';
import { Screen, Pill } from '../components/UI';
import { colors } from '../theme/theme';

type Props = NativeStackScreenProps<UpdatesStackParamList, 'UpdateDetail'>;

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function UpdateDetailScreen({ route, navigation }: Props) {
  const { update } = route.params;

  React.useLayoutEffect(() => {
    navigation.setOptions({ title: update.authority });
  }, [navigation, update.authority]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Pill>{update.kind} · {update.authority}</Pill>
        <Text style={styles.title}>{update.title}</Text>
        <Text style={styles.date}>{formatDate(update.date)}</Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>In plain English</Text>
          <Text style={styles.summaryText}>{update.summary}</Text>
        </View>

        <Text style={styles.sectionLabel}>What it means</Text>
        <Text style={styles.detail}>{update.detail}</Text>

        {update.relatedCats.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Related topics</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              {update.relatedCats.map((cat) => (
                <Pressable
                  key={cat}
                  style={styles.relatedChip}
                  onPress={() =>
                    (navigation as any).getParent()?.navigate('HomeTab', { screen: 'Category', params: { cat } })
                  }
                >
                  <Text style={styles.relatedChipText}>{cat}</Text>
                  <MaterialCommunityIcons name="chevron-right" size={14} color={colors.teal} />
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Pressable style={styles.sourceRow} onPress={() => Linking.openURL(update.sourceUrl)}>
          <MaterialCommunityIcons name="file-document-outline" size={16} color={colors.goldDeep} />
          <Text style={styles.sourceText}>{update.sourceLabel}</Text>
          <MaterialCommunityIcons name="open-in-new" size={14} color={colors.goldDeep} />
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 19, lineHeight: 26, color: colors.ink, fontWeight: '600', marginBottom: 4 },
  date: { fontSize: 12, color: colors.textSecondary, marginBottom: 16 },
  summaryBox: { backgroundColor: colors.tealTint, padding: 14, marginBottom: 18 },
  summaryLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: colors.teal, marginBottom: 6, fontWeight: '700' },
  summaryText: { fontSize: 14.5, lineHeight: 21, color: colors.ink },
  sectionLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: colors.textSecondary, marginBottom: 8, marginTop: 4, fontWeight: '600' },
  detail: { fontSize: 14.5, lineHeight: 22, color: colors.inkSoft, marginBottom: 18 },
  relatedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  relatedChipText: { fontSize: 12, color: colors.ink },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderStyle: 'dashed',
  },
  sourceText: { flex: 1, fontSize: 13, color: colors.goldDeep, fontWeight: '600' },
});
