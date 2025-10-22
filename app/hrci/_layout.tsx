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
    <Stack.Screen name="cases/[id]" />
      </Stack>
    </HrciOnboardingProvider>
  );
}
