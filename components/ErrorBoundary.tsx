import { Colors } from '@/constants/Colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = { 
  children: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
};
type State = { hasError: boolean; error?: Error };

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    try {
      console.error('[ErrorBoundary] Caught render error', { 
        error: error?.message || String(error), 
        stack: error?.stack,
        errorInfo 
      });
      this.props.onError?.(error, errorInfo);
    } catch (logError) {
      console.warn('[ErrorBoundary] Failed to log error', logError);
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  goHome = () => {
    try { 
      router.replace('/'); 
    } catch {
      // Fallback if navigation fails
      console.warn('[ErrorBoundary] Navigation fallback failed');
    }
  };

  showErrorDetails = () => {
    const errorMessage = this.state.error?.message || 'Unknown error';
    const errorStack = this.state.error?.stack || '';
    
    Alert.alert(
      'Error Details',
      `${errorMessage}\n\n${errorStack.split('\n').slice(0, 3).join('\n')}`,
      [
        { text: 'Retry', onPress: this.reset },
        { text: 'Go Home', onPress: this.goHome },
        { text: 'Close', style: 'cancel' }
      ]
    );
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container} accessibilityLabel="Error screen">
          <MaterialCommunityIcons 
            name="alert-circle-outline" 
            size={64} 
            color={Colors.light.muted}
            accessibilityLabel="Error icon"
          />
          <Text style={styles.title} accessibilityRole="header">
            Something went wrong
          </Text>
          <Text style={styles.subtitle} numberOfLines={3} accessible>
            {this.state.error?.message || 'An unexpected error occurred. Please try again.'}
          </Text>
          
          <View style={styles.actions}>
            <Pressable 
              onPress={this.reset} 
              style={styles.primaryButton}
              accessibilityRole="button"
              accessibilityLabel="Try again"
              accessibilityHint="Attempts to reload the screen"
            >
              <MaterialCommunityIcons name="refresh" size={20} color="#fff" />
              <Text style={styles.primaryButtonText}>Try Again</Text>
            </Pressable>
            
            <Pressable 
              onPress={this.showErrorDetails} 
              style={styles.secondaryButton}
              accessibilityRole="button"
              accessibilityLabel="View error details"
              accessibilityHint="Shows technical error information"
            >
              <MaterialCommunityIcons name="information-outline" size={20} color={Colors.light.primary} />
              <Text style={styles.secondaryButtonText}>Details</Text>
            </Pressable>
            
            <Pressable 
              onPress={this.goHome} 
              style={styles.tertiaryButton}
              accessibilityRole="button"
              accessibilityLabel="Go to home"
              accessibilityHint="Returns to the main screen"
            >
              <Text style={styles.tertiaryButtonText}>Go to Home</Text>
            </Pressable>
          </View>
        </View>
      );
    }
    return this.props.children as any;
  }
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 24, 
    backgroundColor: '#f9fafb' 
  },
  title: { 
    fontSize: 24, 
    fontWeight: '700', 
    marginBottom: 8, 
    marginTop: 16,
    color: Colors.light.text,
    textAlign: 'center'
  },
  subtitle: { 
    fontSize: 16, 
    color: Colors.light.muted,
    textAlign: 'center', 
    marginBottom: 32,
    lineHeight: 22
  },
  actions: {
    gap: 12,
    width: '100%',
    maxWidth: 280,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  secondaryButtonText: {
    color: Colors.light.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  tertiaryButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  tertiaryButtonText: {
    color: Colors.light.muted,
    fontSize: 14,
    fontWeight: '500',
  },
});
