import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  SafeAreaView,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { useAuthStore } from '@/stores/authStore';
import { useNotesStore } from '@/stores/notesStore';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { total } = useNotesStore();

  // Local toggle state for integrations/prefs
  const [gmailOn, setGmailOn] = useState(true);
  const [calendarOn, setCalendarOn] = useState(false);
  const [driveOn, setDriveOn] = useState(false);
  const [digestOn, setDigestOn] = useState(true);
  const [hapticOn, setHapticOn] = useState(true);

  const firstName = user?.name?.split(' ')[0] || 'You';

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  const stats = [
    { label: 'NOTES', value: total },
    { label: 'REVIEWS', value: 38 },
    { label: 'CARDS', value: 318 },
  ];

  const integrations = [
    {
      icon: 'envelope' as const,
      iconBg: '#FF4444',
      name: 'Gmail',
      desc: 'Draft & send emails on your behalf',
      value: gmailOn,
      onToggle: setGmailOn,
    },
    {
      icon: 'calendar' as const,
      iconBg: '#4285F4',
      name: 'Google Calendar',
      desc: 'Create events from notes',
      value: calendarOn,
      onToggle: setCalendarOn,
    },
    {
      icon: 'cloud' as const,
      iconBg: '#34A853',
      name: 'Google Drive',
      desc: 'Index docs into your brain',
      value: driveOn,
      onToggle: setDriveOn,
    },
  ];

  const preferences = [
    {
      icon: 'sun-o' as const,
      iconBg: Colors.primary + '30',
      name: 'Daily digest',
      desc: '07:30 every morning',
      value: digestOn,
      onToggle: setDigestOn,
    },
    {
      icon: 'heartbeat' as const,
      iconBg: Colors.primary + '30',
      name: 'Haptic feedback',
      desc: 'Feel every capture',
      value: hapticOn,
      onToggle: setHapticOn,
    },
  ];

  const shortcuts = [
    {
      icon: 'clone' as const,
      iconBg: '#F59E0B',
      name: 'Flashcards',
      desc: "Review today's 12 cards",
      onPress: () => router.push('/flashcards' as any),
    },
    {
      icon: 'book' as const,
      iconBg: '#F59E0B',
      name: 'Daily digest',
      desc: 'Your 3-min catch-up',
      onPress: () => router.push('/digest' as any),
    },
    {
      icon: 'cog' as const,
      iconBg: '#F59E0B',
      name: 'Account settings',
      desc: 'Keys, privacy, export',
      onPress: () => {},
    },
  ];

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* YOU label */}
        <Text style={styles.youLabel}>YOU</Text>
        <Text style={styles.heading}>Profile</Text>

        {/* User card */}
        <View style={styles.userCard}>
          <View style={styles.avatarCircle}>
            {user?.avatar_url ? (
              <Text style={styles.avatarInitial}>{firstName.charAt(0).toUpperCase()}</Text>
            ) : (
              <Text style={styles.avatarInitial}>{firstName.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name || 'NeuraNotes User'}</Text>
            <Text style={styles.userEmail}>{user?.email || 'alex@neuranotes.app'}</Text>
            {/* Pro badge */}
            <View style={styles.proBadge}>
              <FontAwesome name="bolt" size={10} color={Colors.warning} />
              <Text style={styles.proText}>NEURA PRO</Text>
            </View>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {stats.map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Agent Integrations */}
        <Text style={styles.sectionLabel}>AGENT INTEGRATIONS</Text>
        <View style={styles.settingGroup}>
          {integrations.map((item, idx) => (
            <View key={item.name}>
              <View style={styles.settingRow}>
                <View style={[styles.settingIconBadge, { backgroundColor: item.iconBg + '30' }]}>
                  <FontAwesome name={item.icon} size={16} color={item.iconBg} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingName}>{item.name}</Text>
                  <Text style={styles.settingDesc}>{item.desc}</Text>
                </View>
                <Switch
                  value={item.value}
                  onValueChange={item.onToggle}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                  thumbColor={Colors.text}
                  ios_backgroundColor={Colors.border}
                />
              </View>
              {idx < integrations.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        {/* Preferences */}
        <Text style={styles.sectionLabel}>PREFERENCES</Text>
        <View style={styles.settingGroup}>
          {preferences.map((item, idx) => (
            <View key={item.name}>
              <View style={styles.settingRow}>
                <View style={[styles.settingIconBadge, { backgroundColor: Colors.primary + '20' }]}>
                  <FontAwesome name={item.icon} size={16} color={Colors.primary} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingName}>{item.name}</Text>
                  <Text style={styles.settingDesc}>{item.desc}</Text>
                </View>
                <Switch
                  value={item.value}
                  onValueChange={item.onToggle}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                  thumbColor={Colors.text}
                  ios_backgroundColor={Colors.border}
                />
              </View>
              {idx < preferences.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        {/* Shortcuts */}
        <Text style={styles.sectionLabel}>SHORTCUTS</Text>
        <View style={styles.settingGroup}>
          {shortcuts.map((item, idx) => (
            <View key={item.name}>
              <TouchableOpacity style={styles.settingRow} onPress={item.onPress} activeOpacity={0.7}>
                <View style={[styles.settingIconBadge, { backgroundColor: item.iconBg + '30' }]}>
                  <FontAwesome name={item.icon} size={16} color={item.iconBg} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingName}>{item.name}</Text>
                  <Text style={styles.settingDesc}>{item.desc}</Text>
                </View>
                <FontAwesome name="chevron-right" size={13} color={Colors.textMuted} />
              </TouchableOpacity>
              {idx < shortcuts.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <FontAwesome name="sign-out" size={16} color={Colors.error} />
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: 100 },

  // Header
  youLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textMuted,
    letterSpacing: 1.4,
    marginBottom: 2,
    marginTop: Spacing.sm,
  },
  heading: {
    fontSize: 32,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.lg,
  },

  // User card
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primary + '50',
    flexShrink: 0,
  },
  avatarInitial: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  userInfo: { flex: 1 },
  userName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.warning + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.warning + '40',
    alignSelf: 'flex-start',
  },
  proText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: Colors.warning,
    letterSpacing: 0.8,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
    letterSpacing: 0.5,
  },

  // Section label
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: Spacing.sm,
  },

  // Setting group
  settingGroup: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  settingIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  settingInfo: { flex: 1 },
  settingName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    marginBottom: 2,
  },
  settingDesc: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 40 + Spacing.md * 2,
  },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.error + '15',
    borderRadius: BorderRadius.full,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.error + '30',
    marginBottom: Spacing.md,
  },
  logoutText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.error,
  },
});
