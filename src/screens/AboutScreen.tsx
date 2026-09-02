import React from 'react';
import { ScrollView, View, Text, Pressable, Linking, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Screen, SectionTitle } from '../components/UI';
import { colors } from '../theme/theme';

const LINKS = [
  { label: 'Federal Tax Authority', url: 'https://tax.gov.ae' },
  { label: 'Ministry of Finance', url: 'https://mof.gov.ae' },
  { label: 'IFRS Foundation', url: 'https://www.ifrs.org' },
  { label: 'u.ae — Government portal', url: 'https://u.ae' },
];

export default function AboutScreen() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={styles.p}>
          <Text style={{ fontWeight: '700' }}>Content current to September 2026.</Text> This app
          summarises UAE federal legislation, Cabinet and Ministerial Decisions, and standard-setter
          publications for general orientation only. It is not tax, legal or audit advice and
          doesn't cover every free zone authority's local rules.
        </Text>
        <Text style={styles.p}>
          Figures, thresholds and effective dates change through new decisions and FTA
          clarifications — verify anything material against the primary source or a licensed UAE
          tax agent / auditor before relying on it.
        </Text>
        <Text style={styles.p}>
          The "Ask" consultant answers from the bundled knowledge base using on-device keyword
          matching — it does not call an external AI service and does not send your questions
          anywhere. The "Updates" feed is a curated seed dataset that demonstrates how the app
          would surface new FTA/MoF guidance; see the project README for how to connect it to a
          live publications source.
        </Text>

        <SectionTitle>Primary sources</SectionTitle>
        <View style={styles.linkList}>
          {LINKS.map((l) => (
            <Pressable key={l.url} style={styles.linkRow} onPress={() => Linking.openURL(l.url)}>
              <Text style={styles.linkText}>{l.label}</Text>
              <MaterialCommunityIcons name="open-in-new" size={15} color={colors.textSecondary} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  p: { fontSize: 13.5, color: colors.inkSoft, lineHeight: 21, marginBottom: 14 },
  linkList: { borderTopWidth: 1, borderTopColor: colors.border },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  linkText: { fontSize: 14, color: colors.ink },
});
