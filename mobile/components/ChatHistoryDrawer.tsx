import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  FlatList,
  TouchableWithoutFeedback,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
  message_count: number;
}

interface ChatHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNewChat: () => void;
}

const { width, height } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.75;

export default function ChatHistoryDrawer({
  isOpen,
  onClose,
  conversations,
  currentId,
  onSelect,
  onDelete,
  onNewChat,
}: ChatHistoryDrawerProps) {
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0.5,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: -DRAWER_WIDTH,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen]);

  // Pointer events logic: disable touch on overlay if not open
  if (!isOpen && (translateX as any)._value === -DRAWER_WIDTH) return null;

  return (
    <View style={styles.container} pointerEvents={isOpen ? 'auto' : 'none'}>
      {/* Overlay backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          style={[
            styles.overlay,
            { opacity: overlayOpacity },
          ]}
        />
      </TouchableWithoutFeedback>

      {/* Drawer */}
      <Animated.View
        style={[
          styles.drawer,
          { transform: [{ translateX }] },
        ]}
      >
        <SafeAreaWrapper>
          <View style={styles.header}>
            <TouchableOpacity style={styles.newChatBtn} onPress={onNewChat}>
              <FontAwesome name="plus" size={16} color={Colors.textInverse} />
              <Text style={styles.newChatText}>New Chat</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={conversations}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const isSelected = item.id === currentId;
              return (
                <TouchableOpacity
                  style={[styles.item, isSelected && styles.itemSelected]}
                  onPress={() => onSelect(item.id)}
                  activeOpacity={0.7}
                >
                  <FontAwesome 
                    name="comment-o" 
                    size={14} 
                    color={isSelected ? Colors.primary : Colors.textMuted} 
                    style={styles.itemIcon} 
                  />
                  <View style={styles.itemContent}>
                    <Text 
                      style={[styles.itemTitle, isSelected && styles.itemTitleSelected]} 
                      numberOfLines={1}
                    >
                      {item.title || 'New Conversation'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => onDelete(item.id)} style={styles.deleteBtn}>
                    <FontAwesome name="trash-o" size={14} color={Colors.textMuted} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            }}
          />
        </SafeAreaWrapper>
      </Animated.View>
    </View>
  );
}

// Simple wrapper to avoid top notch safely
const SafeAreaWrapper = ({ children }: { children: React.ReactNode }) => (
  <View style={{ flex: 1, paddingTop: 50, paddingBottom: 20 }}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_WIDTH,
    backgroundColor: Colors.backgroundSecondary,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  header: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    gap: 8,
  },
  newChatText: {
    color: Colors.textInverse,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.md,
  },
  list: {
    padding: Spacing.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: 4,
  },
  itemSelected: {
    backgroundColor: Colors.primary + '15',
  },
  itemIcon: {
    marginRight: Spacing.sm,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
  itemTitleSelected: {
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  deleteBtn: {
    padding: 4,
  },
});
