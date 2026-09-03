import React from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { HAS_BACKEND } from '../config';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { UpdatesStackParamList } from '../navigation/types';
import { useUpdates } from '../context/UpdatesContext';
import { Screen, EmptyState } from '../components/UI';
import { RegUpdate } from '../types';
import { colors } from '../theme/theme';

type Props = NativeStackScreenProps<UpdatesStackParamList, 'UpdatesList'>;

const KIND_LABEL: Record<RegUpdate['kind'], string> = {
  Guideline: 'Guideline',
  'Public Clarification': 'Public Clarification',
  Decision: 'Decision',
  Notification: 'Notification',
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function UpdatesListScreen({ navigation }: Props) {
  const { updates, isRead, markRead, markAllRead, unreadCount, refresh, refreshing, connectionState } = useUpdates();

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        unreadCount > 0 ? (
          <Pressable onPress={markAllRead} hitSlop={10} style={{ padding: 4 }}>
            <Text style={styles.markAll}>Mark all read</Text>
          </Pressable>
        ) : null,
    });
  }, [navigation, unreadCount, markAllRead]);

  return (
    <Screen>
      <FlatList
        data={updates}
        keyExtractor={(u) => u.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          HAS_BACKEND ? (
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.teal} />
          ) : undefined
        }
        ListHeaderComponent={
          <View>
            <Text style={styles.hero}>
              New guidelines, decisions and public clarifications from the FTA, MoF and standard
              setters — with a plain-English summary of what each one actually changes.
            </Text>
            <View style={styles.liveRow}>
              <View
                style={[
                  styles.liveDot,
                  {
                    backgroundColor:
                      connectionState === 'live'
                        ? colors.teal
                        : connectionState === 'offline'
                        ? colors.danger
                        : colors.textSecondary,
                  },
                ]}
              />
              <Text style={styles.liveText}>
                {!HAS_BACKEND
                  ? 'Bundled offline data (no backend configured)'
                  : connectionState === 'live'
                  ? 'Live from backend'
                  : connectionState === 'checking'
                  ? 'Connecting…'
                  : 'Offline — showing bundled data (pull to retry)'}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={<EmptyState label="No updates yet." />}
        renderItem={({ item }) => {
          const unread = !isRead(item.id);
          return (
            <Pressable
              onPress={() => {
                markRead(item.id);
                navigation.navigate('UpdateDetail', { update: item });
              }}
              style={({ pressed }) => [styles.card, unread && styles.cardUnread, pressed && { opacity: 0.7 }]}
            >
              <View style={styles.cardTopRow}>
                <View style={styles.authorityPill}>
                  <Text style={styles.authorityText}>{item.authority}</Text>
                </View>
                <Text style={styles.kindText}>{KIND_LABEL[item.kind]}</Text>
                {unread && <View style={styles.dot} />}
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.summary}>{item.summary}</Text>
              <Text style={styles.date}>{formatDate(item.date)}</Text>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { fontSize: 13, color: colors.textSecondary, marginBottom: 10, lineHeight: 19 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontSize: 11, color: colors.textSecondary },
  markAll: { color: '#fff', fontSize: 12.5, fontWeight: '600' },
  card: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: colors.gold },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  authorityPill: { backgroundColor: colors.tealTint, paddingHorizontal: 8, paddingVertical: 2 },
  authorityText: { fontSize: 10.5, color: colors.teal, fontWeight: '700', letterSpacing: 0.3 },
  kindText: { fontSize: 11, color: colors.textSecondary, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold },
  title: { fontSize: 15, fontWeight: '600', color: colors.ink, marginBottom: 6, lineHeight: 20 },
  summary: { fontSize: 13, color: colors.inkSoft, lineHeight: 19, marginBottom: 8 },
  date: { fontSize: 11, color: colors.textSecondary },
});
