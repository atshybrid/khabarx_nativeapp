import KYCGateNew from '@/components/KYCGateNew';
import { useAuth } from '@/context/AuthContext';
import React from 'react';

// Example of how to integrate KYC checking in your main app layout
export default function AppWithKYC({ children }: { children: React.ReactNode }) {
  const { jwt } = useAuth(); // Get JWT token from your auth context
  
  // You'll need to decode the JWT or get user data from another source
  // For now, this is a placeholder - replace with your actual user data logic
  const isLoggedIn = !!jwt;
  const membershipId = 'USER_MEMBERSHIP_ID'; // Replace with actual logic to get membership ID
  
  return (
    <KYCGateNew 
      isLoggedIn={isLoggedIn}
      membershipId={isLoggedIn ? membershipId : undefined}
    >
      {children}
    </KYCGateNew>
  );
}

// Usage example in your _layout.tsx or main app component:
/*
export default function RootLayout() {
  return (
    <AuthProvider>
      <AppWithKYC>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="hrci/kyc/complete" options={{ presentation: 'modal' }} />
          // ... other screens
        </Stack>
      </AppWithKYC>
    </AuthProvider>
  );
}
*/