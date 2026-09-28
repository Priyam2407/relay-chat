import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

const time = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

function MessageBubble({ message, own, receipt, onRetry }) {
  const failed = message.status === 'failed';
  return (
    <View style={[styles.row, own ? styles.rowOwn : styles.rowOther]}>
      <View style={[styles.bubble, own ? styles.own : styles.other]}>
        {!own && <Text style={styles.author}>{message.username}</Text>}
        <Text style={[styles.text, own && { color: colors.primaryText }]}>{message.text}</Text>
        <View style={styles.meta}>
          {message.status === 'sending' && <Text style={[styles.time, own && styles.timeOwn]}>Sending…</Text>}
          {failed && (
            <Pressable onPress={() => onRetry(message.clientId)}>
              <Text style={styles.failed}>Not sent. Tap to retry</Text>
            </Pressable>
          )}
          {!failed && message.status !== 'sending' && (
            <Text style={[styles.time, own && styles.timeOwn]}>
              {time(message.createdAt)}
              {own && receipt ? (
                <Text style={receipt === 'read' ? styles.tickRead : undefined}>
                  {receipt === 'sent' ? '  ✓' : '  ✓✓'}
                </Text>
              ) : null}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12, marginVertical: 3, flexDirection: 'row' },
  rowOwn: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  own: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  other: { backgroundColor: colors.surface, borderBottomLeftRadius: 4 },
  author: { fontSize: 12, fontWeight: '700', color: colors.primary, marginBottom: 2 },
  text: { fontSize: 16, lineHeight: 22, color: colors.text },
  meta: { alignSelf: 'flex-end', marginTop: 2 },
  time: { fontSize: 11, color: colors.muted },
  timeOwn: { color: '#A9C7C4' },
  tickRead: { color: colors.accent, fontWeight: '700' },
  failed: { fontSize: 12, color: '#FFB4AB', fontWeight: '600' },
});

export default React.memo(MessageBubble);
