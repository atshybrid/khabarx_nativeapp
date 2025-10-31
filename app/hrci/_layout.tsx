import { Stack } from 'expo-router';
import { HrciOnboardingProvider } from '../../context/HrciOnboardingContext';

export default function HrciLayout() {
  return (
    <HrciOnboardingProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="level" />
        <Stack.Screen name="cells" />
        <Stack.Screen name="designations" />
        <Stack.Screen name="geo" />
        <Stack.Screen name="availability" />
        <Stack.Screen name="register" />
        <Stack.Screen name="cases/index" />
        <Stack.Screen name="cases/new" />
        <Stack.Screen name="admin/cases" />
        <Stack.Screen name="admin/index" />
  {/* Events routes live under a folder; point to index explicitly */}
  <Stack.Screen name="admin/events/index" />
  <Stack.Screen name="admin/events/new" />
        <Stack.Screen name="admin/payments" />
        <Stack.Screen name="admin/stories" />
  {/* KYC admin list is at index; avoid pattern conflict by targeting index explicitly */}
  <Stack.Screen name="admin/kyc/index" />
  <Stack.Screen name="admin/kyc/[membershipId]" />
        <Stack.Screen name="admin/settings" />
        <Stack.Screen name="admin/discounts/index" />
        <Stack.Screen name="admin/discounts/new" />
        <Stack.Screen name="admin/discounts/[id]" />
    <Stack.Screen name="cases/[id]" />
      </Stack>
    </HrciOnboardingProvider>
  );
}
