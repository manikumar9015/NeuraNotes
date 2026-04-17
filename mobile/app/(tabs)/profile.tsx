import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadow } from '@/constants/theme';
import { useAuthStore } from '@/stores/authStore';
import { useNotesStore } from '@/stores/notesStore';

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const { total } = useNotesStore();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  const stats = [
    { label: 'Total Notes', value: total.toString(), icon: 'file-text-o' as const, color: Colors.primary },
    { label: 'AI Chats', value: '—', icon: 'comments' as const, color: Colors.accent },
    { label: 'Tags Used', value: '—', icon: 'tags' as const, color: Colors.success },
  ];

  const settings = [
    { label: 'API Server', value: 'localhost:8000', icon: 'server' as const },
    { label: 'AI Provider', value: 'Groq (Free)', icon: 'bolt' as const },
    { label: 'Embedding Model', value: 'gemini-embedding-001', icon: 'cube' as const },
    { label: 'Offline Mode', value: 'Coming soon', icon: 'cloud-download' as const },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* User Card */}
      {!user ? (
        <View style={styles.userCard}>
          <Text style={styles.userName}>Not logged in</Text>
          <Text style={styles.userEmail}>Sign in to use NeuraNotes</Text>
          <TouchableOpacity 
            style={[styles.logoutButton, { backgroundColor: Colors.primary + '15', borderColor: Colors.primary + '30', marginTop: Spacing.md }]} 
            onPress={useAuthStore.getState().devLogin}
          >
            <FontAwesome name="check-circle" size={16} color={Colors.primary} />
            <Text style={[styles.logoutText, { color: Colors.primary }]}>Quick Test Login</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
          <Text style={styles.userName}>{user?.name || 'NeuraNotes User'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'No email'}</Text>
        </View>
      )}

      {/* Stats */}
      <View style={styles.statsRow}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.statCard}>
            <FontAwesome name={stat.icon} size={20} color={stat.color} />
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Settings */}
      <Text style={styles.sectionTitle}>Configuration</Text>
      {settings.map((item) => (
        <View key={item.label} style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <FontAwesome name={item.icon} size={16} color={Colors.textSecondary} />
            <Text style={styles.settingLabel}>{item.label}</Text>
          </View>
          <Text style={styles.settingValue}>{item.value}</Text>
        </View>
      ))}

      {/* About */}
      <Text style={styles.sectionTitle}>About</Text>
      <View style={styles.aboutCard}>
        <Text style={styles.aboutName}>NeuraNotes v1.0</Text>
        <Text style={styles.aboutDescription}>
          Personal Second Brain Agent{'\n'}
          Built with React Native + FastAPI + Groq
        </Text>
        <Text style={styles.aboutCost}>💰 Total cost: $0/month</Text>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <FontAwesome name="sign-out" size={16} color={Colors.error} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  userCard: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    ...Shadow.md,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  avatarText: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  userName: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  userEmail: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginTop: Spacing.sm,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  settingLabel: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
  settingValue: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  aboutCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  aboutName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  aboutDescription: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  aboutCost: {
    fontSize: FontSize.sm,
    color: Colors.success,
    fontWeight: FontWeight.semibold,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.error + '15',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.error + '30',
  },
  logoutText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.error,
  },
});
