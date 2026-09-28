import React, { useState } from 'react';
import { KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme';

const VALID = /^[a-zA-Z0-9_]{2,20}$/;

export default function LoginScreen({ onLogin }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    const value = name.trim();
    if (!VALID.test(value)) {
      setError('Use 2-20 letters, numbers or underscores.');
      return;
    }
    onLogin(value);
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
      <View style={styles.card}>
        <Text style={styles.title}>Relay</Text>
        <Text style={styles.sub}>Pick a username to join the room.</Text>
        <TextInput
          style={[styles.input, !!error && { borderColor: colors.danger }]}
          value={name}
          onChangeText={(t) => { setName(t); setError(''); }}
          placeholder="Username"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={submit}
        />
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Pressable style={styles.button} onPress={submit}>
          <Text style={styles.buttonText}>Join chat</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.bg },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 24 },
  title: { fontSize: 34, fontWeight: '800', color: colors.primary },
  sub: { fontSize: 16, color: colors.muted, marginTop: 4, marginBottom: 20 },
  input: {
    borderWidth: 1.5, borderColor: '#D3DEDD', borderRadius: 12, paddingHorizontal: 14,
    height: 50, fontSize: 16, color: colors.text,
  },
  error: { color: colors.danger, marginTop: 8, fontSize: 13 },
  button: { marginTop: 18, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  buttonText: { color: colors.primaryText, fontSize: 16, fontWeight: '700' },
});
