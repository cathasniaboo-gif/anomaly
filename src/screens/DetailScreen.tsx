import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HomeStackParamList } from '../navigation/types';
import { Screen, Pill } from '../components/UI';
import { colors } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'Detail'>;

export default function DetailScreen({ route, navigation }: Props) {
  const { item } = route.params;

  React.useLayoutEffect(() => {
    navigation.setOptions({ title: item.cat });
  }, [navigation, item.cat]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Pill>{item.cat}</Pill>
        <Text style={styles.q}>{item.q}</Text>
        <Text style={styles.a}>{item.a}</Text>
        <View style={styles.metaBox}>
          <Text style={styles.metaLine}>
            <Text style={styles.metaLabel}>Source: </Text>
            {item.src}
          </Text>
          <Text style={styles.metaLine}>
            <Text style={styles.metaLabel}>Noted current: </Text>
            {item.updated}
          </Text>
        </View>
        <Text style={styles.disclaimer}>
          General orientation only, not tax or legal advice. Verify anything material against the
          primary source or a licensed UAE tax agent / auditor.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  q: { fontSize: 19, lineHeight: 26, marginBottom: 14, color: colors.ink, fontWeight: '600' },
  a: { fontSize: 15, lineHeight: 23, color: colors.inkSoft },
  metaBox: {
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderStyle: 'dashed',
  },
  metaLine: { fontSize: 12.5, color: colors.textSecondary, marginBottom: 5 },
  metaLabel: { color: colors.inkSoft, fontWeight: '600' },
  disclaimer: { fontSize: 11.5, color: colors.textSecondary, marginTop: 18, lineHeight: 17, fontStyle: 'italic' },
});
