import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error?: any };

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    try {
      console.error('[ErrorBoundary] Caught render error', { error: error?.message || String(error), info });
    } catch {}
  }

  reset = () => {
    this.setState({ hasError: false, error: undefined });
    try { router.replace('/news'); } catch {}
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle} numberOfLines={3}>
            {(this.state.error?.message as string) || 'An unexpected error occurred.'}
          </Text>
          <Pressable onPress={this.reset} style={styles.button}>
            <Text style={styles.buttonText}>Go to Home</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children as any;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 8, color: '#111827' },
  subtitle: { fontSize: 13, opacity: 0.7, textAlign: 'center', marginBottom: 16, color: '#374151' },
  button: { backgroundColor: '#1D4ED8', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: '700' },
});
