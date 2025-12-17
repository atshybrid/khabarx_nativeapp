import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { emit } from '@/services/events';

export default function MembershipDetailScreen() {
  useEffect(() => {
    // This screen is intentionally disabled.
    // Details are shown via bottom sheet on the list screen.
    try { emit('toast:show', { message: 'Open member details from the list.' }); } catch {}
    try { router.replace('/memberships' as any); } catch { try { router.back(); } catch {} }
  }, []);

  return <View />;
}
