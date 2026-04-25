import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useChatStore } from '@/stores/chatStore';
import { Colors } from '@/constants/theme';

export default function ChatTabRedirect() {
  const router = useRouter();
  const { createConversation, clearMessages } = useChatStore();

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;

      const initChat = async () => {
        clearMessages();
        if (isActive) {
          router.push(`/chat/new` as any);
        }
      };
      
      initChat();

      return () => {
        isActive = false;
      };
    }, [])
  );

  return (
    <View style={styles.root}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
