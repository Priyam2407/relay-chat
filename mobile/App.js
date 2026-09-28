import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from './src/screens/LoginScreen';
import ChatScreen from './src/screens/ChatScreen';
import { colors } from './src/theme';

const KEY = 'chat.username';

export default function App() {
  const [username, setUsername] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => v && setUsername(v))
      .finally(() => setReady(true));
  }, []);

  const login = async (name) => {
    await AsyncStorage.setItem(KEY, name);
    setUsername(name);
  };
  const logout = async () => {
    await AsyncStorage.removeItem(KEY);
    setUsername(null);
  };

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={username ? 'light' : 'dark'} />
      {username ? <ChatScreen username={username} onLogout={logout} /> : <LoginScreen onLogin={login} />}
    </SafeAreaProvider>
  );
}
