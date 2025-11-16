import { Theme } from '@/constants/Theme';
import type { MembershipRecord } from '@/types/memberships';
import { Image, StyleSheet, Text, View } from 'react-native';

interface Props {
  membership: MembershipRecord;
}

export function MemberListItem({ membership }: Props) {
  const { designation, cell } = membership;
  const fullName = membership.fullName || membership.idCard?.fullName || 'Unknown';
  const initials = fullName.split(/\s+/).slice(0,2).map(part => part[0]?.toUpperCase()).join('');
  const photo = membership.profilePhotoUrl || (membership.idCard as any)?.photoUrl || (membership.idCard?.meta?.photoUrl) || null;
  const location = membership.hrcCountryName || membership.hrcStateName || membership.hrcDistrictName || membership.hrcMandalName || membership.zone || 'Location N/A';
  const created = membership.createdAt ? (() => { try { return new Date(membership.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return membership.createdAt; } })() : undefined;
  const mobileMasked = membership.mobileNumber ? (String(membership.mobileNumber).replace(/^(\d{3})(\d+)(\d{2})$/, '$1***$3')) : undefined;

  return (
    <View style={styles.card} accessibilityRole="button" accessibilityLabel={`${fullName}, ${designation?.name || ''}, ${membership.level || ''}`}>      
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
        </View>
      </View>
    </View>
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
