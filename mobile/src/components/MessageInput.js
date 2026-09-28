import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme';

export default function MessageInput({ onSend, onTyping, onStopTyping }) {
  const [text, setText] = useState('');
  const canSend = text.trim().length > 0;

  const submit = () => {
    if (!canSend) return;
    onSend(text);
    setText('');
    onStopTyping();
  };

  return (
    <View style={styles.bar}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={(t) => { setText(t); onTyping(); }}
        placeholder="Write a message"
        placeholderTextColor={colors.muted}
        multiline
        maxLength={1000}
        onSubmitEditing={submit}
      />
      <Pressable
        onPress={submit}
        disabled={!canSend}
        style={[styles.send, !canSend && { opacity: 0.4 }]}
        accessibilityLabel="Send message"
      >
        <Text style={styles.sendText}>Send</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, gap: 8, backgroundColor: colors.surface },
  input: {
    flex: 1, maxHeight: 120, minHeight: 44, borderRadius: 22, paddingHorizontal: 16,
    paddingTop: 12, paddingBottom: 12, fontSize: 16, color: colors.text, backgroundColor: colors.bg,
  },
  send: { height: 44, paddingHorizontal: 18, borderRadius: 22, justifyContent: 'center', backgroundColor: colors.accent },
  sendText: { fontWeight: '700', fontSize: 15, color: colors.text },
});
