import { Theme } from '@/constants/Theme';
import { reissueAdminMembershipIdCard } from '@/services/hrciAdmin';
import type { MembershipRecord } from '@/types/memberships';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  membership: MembershipRecord;
  onPress?: () => void;
}

export function MemberListItem({ membership, onPress }: Props) {
  const { designation, cell } = membership;
  // Prefer top-level `fullName` (API returns it), then idCard fullName, then user profile name
  const fullName = (membership as any).fullName || membership.idCard?.fullName || (membership as any).user?.profile?.fullName || 'Unknown';
  const initials = String(fullName || '').split(/\s+/).slice(0,2).map((part: string) => part[0]?.toUpperCase()).join('');
  const photo = (membership as any).profilePhotoUrl || (membership.idCard as any)?.photoUrl || (membership.idCard?.meta?.photoUrl) || null;
  const location = (membership as any).hrcCountryName || (membership as any).hrcStateName || (membership as any).hrcDistrictName || (membership as any).hrcMandalName || membership.zone || 'Location N/A';
  const created = membership.createdAt ? (() => { try { return new Date(membership.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return membership.createdAt; } })() : undefined;
  const mobileMasked = (membership.idCard?.mobileNumber || (membership as any).mobileNumber || (membership as any).mobileNumber) ? (String(membership.idCard?.mobileNumber || (membership as any).mobileNumber).replace(/^(\d{3})(\d+)(\d{2})$/, '$1***$3')) : undefined;
  // cardNumber may be provided either nested under idCard or top-level as idCardNumber
  const cardNumber = membership.idCard?.cardNumber || (membership as any).idCardNumber;
  const [reissuing, setReissuing] = useState(false);

  const Container: any = onPress ? Pressable : View;
  const containerProps: any = onPress
    ? {
        onPress,
        style: ({ pressed }: any) => [styles.card, pressed && { opacity: 0.9 }],
        accessibilityRole: 'button',
        accessibilityLabel: `${fullName}, ${designation?.name || ''}, ${membership.level || ''}`,
      }
    : {
        style: styles.card,
        accessibilityRole: 'button',
        accessibilityLabel: `${fullName}, ${designation?.name || ''}, ${membership.level || ''}`,
      };

  return (
    <Container {...containerProps}>
      <View style={styles.row}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}><Text style={styles.avatarText}>{initials || '?'}</Text></View>
        )}
        <View style={styles.mainContent}>
          <View style={styles.titleRow}>
            <Text style={styles.name} numberOfLines={1}>{fullName}</Text>
            <View style={[styles.badge, membership.status === 'ACTIVE' ? styles.badgeActive : styles.badgeInactive]}>
              <Text style={styles.badgeText}>{membership.status || '—'}</Text>
            </View>
          </View>

          <Text style={styles.subLine} numberOfLines={1}>{designation?.name || '—'} • {membership.level || '—'}{cell?.name ? ` • ${cell.name}` : ''}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLine} numberOfLines={1}>{location}</Text>
            {mobileMasked ? <Text style={styles.mobileText}>{mobileMasked}</Text> : null}
          </View>
          {created ? <Text style={styles.createdText}>Joined {created}</Text> : null}
          {cardNumber ? (
            <View style={{ marginTop: 8 }}>
              <Pressable onPress={async (e) => {
                // Avoid triggering the card onPress when tapping this action.
                try { (e as any)?.stopPropagation?.(); } catch {}
                if (!membership.id) return;
                const cn = cardNumber;
                Alert.alert('Reissue ID Card', `Reissue ID card for ${fullName}?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Reissue', style: 'destructive', onPress: async () => {
                    try {
                      setReissuing(true);
                      await reissueAdminMembershipIdCard(membership.id, cn || undefined);
                      Alert.alert('Success', 'ID card reissue request sent.');
                    } catch (e: any) {
                      Alert.alert('Failed', e?.message || 'Failed to reissue ID card');
                    } finally {
                      setReissuing(false);
                    }
                  } }
                ]);
              }} style={({ pressed }) => [{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#eef2ff', alignSelf: 'flex-start' }, pressed && { opacity: 0.9 }]} accessibilityRole="button" accessibilityLabel="Reissue ID Card">
                {reissuing ? <ActivityIndicator /> : <Text style={{ color: '#1e3a8a', fontWeight: '700' }}>Reissue ID Card</Text>}
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: Theme.spacing.lg, marginTop: Theme.spacing.sm, backgroundColor: '#ffffff', borderRadius: Theme.radius.lg, padding: Theme.spacing.md, elevation: Theme.elevation.card },
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#cbd5e1' },
  avatarFallback: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#94a3b8', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#ffffff', fontSize: 20, fontWeight: '700' },
  mainContent: { flex: 1, marginLeft: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 16, fontWeight: '700', color: Theme.color.text, flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginLeft: 8, alignSelf: 'flex-start' },
  badgeActive: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#10b981' },
  badgeInactive: { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#f59e0b' },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#065f46' },
  subLine: { marginTop: 6, fontSize: 13, color: Theme.color.subtleText, fontWeight: '500' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  metaLine: { flex: 1, fontSize: 12, color: '#475569' },
  mobileText: { marginLeft: 12, fontSize: 12, color: '#475569', fontWeight: '600' },
  createdText: { marginTop: 6, fontSize: 11, color: '#6b7280' },
});

export default MemberListItem;
