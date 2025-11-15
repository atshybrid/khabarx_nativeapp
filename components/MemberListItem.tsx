import { Theme } from '@/constants/Theme';
import type { MembershipRecord } from '@/types/memberships';
import { Image, StyleSheet, Text, View } from 'react-native';

interface Props {
  membership: MembershipRecord;
}

export function MemberListItem({ membership }: Props) {
  const { designation, cell, idCard } = membership;
  const fullName = idCard?.fullName || 'Un-named';
  const initials = fullName.split(/\s+/).slice(0,2).map(part => part[0]?.toUpperCase()).join('');
  const photo = (idCard as any)?.photoUrl || (idCard?.meta?.photoUrl) || null;
  const location = membership.zone || membership.hrcDistrictId || membership.hrcStateId || membership.hrcMandalId || '—';

  return (
    <View style={styles.card} accessibilityRole="button" accessibilityLabel={`${fullName}, ${designation.name}, ${membership.level}`}>      
      <View style={styles.row}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}><Text style={styles.avatarText}>{initials || '?'}</Text></View>
        )}
        <View style={styles.mainContent}>
          <Text style={styles.name} numberOfLines={1}>{fullName}</Text>
          <Text style={styles.subLine} numberOfLines={1}>{designation.name} • {membership.level}{cell?.name ? ` • ${cell.name}` : ''}</Text>
          <Text style={styles.metaLine} numberOfLines={1}>{location !== '—' ? location : 'Location N/A'}</Text>
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
  name: { fontSize: 16, fontWeight: '700', color: Theme.color.text },
  subLine: { marginTop: 2, fontSize: 13, color: Theme.color.subtleText, fontWeight: '500' },
  metaLine: { marginTop: 2, fontSize: 12, color: '#475569' },
});

export default MemberListItem;
