import React, { useCallback } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useChat from '../hooks/useChat';
import MessageBubble from '../components/MessageBubble';
import MessageInput from '../components/MessageInput';
import { colors } from '../theme';

export default function ChatScreen({ username, onLogout }) {
  const chat = useChat(username);
  // Inverted list: newest message at index 0 keeps the view pinned to the bottom.
  const data = [...chat.messages].reverse();

  // sent -> delivered -> read, based on what other users have reported
  const receiptFor = useCallback(
    (m) => {
      if (m.username !== username || !m.id || m.status === 'sending' || m.status === 'failed') return null;
      const others = Object.entries(chat.receipts).filter(([u]) => u !== username).map(([, r]) => r);
      if (others.some((r) => r.read >= m.id)) return 'read';
      if (others.some((r) => Math.max(r.delivered, r.read) >= m.id)) return 'delivered';
      return 'sent';
    },
    [username, chat.receipts]
  );

  const renderItem = useCallback(
    ({ item }) => (
      <MessageBubble message={item} own={item.username === username} receipt={receiptFor(item)} onRetry={chat.retry} />
    ),
    [username, chat.retry, receiptFor]
  );

  const others = chat.online.filter((u) => u !== username);
  const typingText =
    chat.typing.length === 0 ? null
    : chat.typing.length === 1 ? `${chat.typing[0]} is typing…`
    : `${chat.typing.length} people are typing…`;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Relay</Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: chat.connected ? colors.online : colors.accent }]} />
            <Text style={styles.status} numberOfLines={1}>
              {chat.connected
                ? others.length ? `Online: ${others.join(', ')}` : 'You are the only one here'
                : 'Reconnecting…'}
            </Text>
          </View>
        </View>
        <Pressable onPress={onLogout} hitSlop={8}>
          <Text style={styles.logout}>{username} · Leave</Text>
        </Pressable>
      </View>

      {!!chat.error && (
        <Pressable style={styles.banner} onPress={chat.dismissError}>
          <Text style={styles.bannerText}>{chat.error} (tap to dismiss)</Text>
        </Pressable>
      )}

      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior="padding">
        {chat.loading ? (
          <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />
        ) : (
          <FlatList
            style={{ flex: 1 }}
            data={data}
            extraData={chat.receipts}
            inverted
            keyExtractor={(m) => m.clientId || String(m.id)}
            renderItem={renderItem}
            contentContainerStyle={{ paddingVertical: 8 }}
            ListEmptyComponent={
              <Text style={[styles.empty, { transform: [{ scaleY: -1 }] }]}>No messages yet. Say hello.</Text>
            }
          />
        )}
        <View style={styles.typingSlot}>
          {!!typingText && <Text style={styles.typing}>{typingText}</Text>}
        </View>
        <MessageInput onSend={chat.send} onTyping={chat.notifyTyping} onStopTyping={chat.stopTyping} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.primary },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.primary },
  title: { fontSize: 20, fontWeight: '800', color: colors.primaryText },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  status: { fontSize: 12, color: '#A9C7C4', flexShrink: 1 },
  logout: { fontSize: 13, color: colors.primaryText, fontWeight: '600' },
  banner: { backgroundColor: colors.danger, paddingHorizontal: 16, paddingVertical: 8 },
  bannerText: { color: '#fff', fontSize: 13 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40 },
  typingSlot: { height: 22, paddingHorizontal: 16, justifyContent: 'center' },
  typing: { fontSize: 12, color: colors.muted, fontStyle: 'italic' },
});
