import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../components/UI';
import { answerQuestion, SUGGESTED_QUESTIONS } from '../services/answerEngine';
import { KnowledgeItem } from '../types';
import { colors } from '../theme/theme';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  item?: KnowledgeItem;
  alternatives?: KnowledgeItem[];
  isIntro?: boolean;
}

let msgCounter = 0;
function nextId() {
  msgCounter += 1;
  return `msg-${msgCounter}`;
}

const INTRO: ChatMessage = {
  id: nextId(),
  role: 'assistant',
  isIntro: true,
  text:
    "Ask me about UAE Corporate Tax, VAT, free zones vs. mainland, business setup, IFRS/IAS, AML/CFT, labour law, visas and more. I answer from a bundled knowledge base of UAE laws and regulations — not a live legal opinion, so confirm anything material with a licensed tax agent or the primary source.",
};

export default function AskScreen() {
  const navigation = useNavigation<any>();
  const [messages, setMessages] = useState<ChatMessage[]>([INTRO]);
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList>(null);

  const openItem = useCallback(
    (item: KnowledgeItem) => {
      navigation.getParent()?.navigate('HomeTab', { screen: 'Detail', params: { item } });
    },
    [navigation]
  );

  const send = useCallback(
    (text: string) => {
      const question = text.trim();
      if (!question) return;
      const userMsg: ChatMessage = { id: nextId(), role: 'user', text: question };
      const result = answerQuestion(question);

      let assistantMsg: ChatMessage;
      if (result.best && result.confident) {
        assistantMsg = {
          id: nextId(),
          role: 'assistant',
          text: result.best.a,
          item: result.best,
          alternatives: result.alternatives,
        };
      } else if (result.best) {
        assistantMsg = {
          id: nextId(),
          role: 'assistant',
          text: "I'm not fully certain, but this is closest to what you asked:",
          item: result.best,
          alternatives: result.alternatives,
        };
      } else {
        assistantMsg = {
          id: nextId(),
          role: 'assistant',
          text:
            "I don't have that in my knowledge base yet. Try rephrasing, or browse Home by topic — Corporate Tax, Free Zones, VAT, IFRS/IAS, AML and more.",
        };
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput('');
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    },
    []
  );

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 12 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <ChatBubble message={item} onOpenItem={openItem} />
          )}
          ListFooterComponent={
            messages.length <= 1 ? (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.suggestLabel}>Try asking</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <Pressable key={q} onPress={() => send(q)} style={styles.chip}>
                      <Text style={styles.chipText}>{q}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null
          }
        />
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Ask about tax, free zones, IFRS…"
            placeholderTextColor={colors.textSecondary}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => send(input)}
            returnKeyType="send"
          />
          <Pressable onPress={() => send(input)} style={styles.sendBtn} hitSlop={8}>
            <MaterialCommunityIcons name="send" size={18} color={colors.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function ChatBubble({
  message,
  onOpenItem,
}: {
  message: ChatMessage;
  onOpenItem: (item: KnowledgeItem) => void;
}) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{message.text}</Text>
        {message.item && (
          <Pressable onPress={() => onOpenItem(message.item!)} style={styles.sourceLink}>
            <Text style={styles.sourceLinkText}>
              {message.item.cat} · {message.item.src}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={14} color={colors.teal} />
          </Pressable>
        )}
        {!!message.alternatives?.length && (
          <View style={{ marginTop: 8, gap: 6 }}>
            {message.alternatives.map((alt) => (
              <Pressable key={alt.id} onPress={() => onOpenItem(alt)} style={styles.altRow}>
                <Text style={styles.altText}>{alt.q}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubbleRow: { marginBottom: 12, alignItems: 'flex-start' },
  bubbleRowUser: { alignItems: 'flex-end' },
  bubble: { maxWidth: '88%', padding: 12, borderWidth: 1 },
  bubbleAssistant: { backgroundColor: colors.panel, borderColor: colors.border },
  bubbleUser: { backgroundColor: colors.ink, borderColor: colors.ink },
  bubbleText: { fontSize: 14.5, lineHeight: 21, color: colors.inkSoft },
  bubbleTextUser: { color: colors.white },
  sourceLink: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  sourceLinkText: { fontSize: 11.5, color: colors.teal, fontWeight: '600' },
  altRow: { backgroundColor: colors.tealTint, padding: 8 },
  altText: { fontSize: 12.5, color: colors.ink },
  suggestLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  chipText: { fontSize: 12.5, color: colors.ink },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.panel,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14.5,
    color: colors.ink,
    backgroundColor: colors.paper,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
