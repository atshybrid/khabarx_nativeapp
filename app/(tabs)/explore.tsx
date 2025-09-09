import { Colors } from '@/constants/Colors';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PostCreateScreen() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const router = useRouter();
  const navigation = useNavigation();
  const { setTabBarVisible } = useTabBarVisibility();

  useEffect(() => {
    setTabBarVisible(false);
    return () => setTabBarVisible(true);
  }, [setTabBarVisible]);

  const onSubmit = () => {
    if (!title.trim()) return Alert.alert('Title required');
    if (!content.trim()) return Alert.alert('Content required');
    // TODO: integrate backend submit
    Alert.alert('Post created (demo)', 'Your article draft is saved.');
    setTitle('');
    setContent('');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.appBar}>
        <Pressable
          onPress={() => {
            if ((navigation as any)?.canGoBack?.()) {
              (navigation as any).goBack();
            } else {
              router.replace('/news');
            }
          }}
          style={styles.backRow}
        >
          <Feather name="arrow-left" size={22} color={Colors.light.primary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.appBarTitle}>Create Article</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Details</Text>
        <Text style={styles.label}>Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Enter a catchy headline"
          style={styles.input}
          placeholderTextColor="#999"
        />
        <Text style={styles.label}>Content</Text>
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="Write your story..."
          style={[styles.input, styles.multiline]}
          placeholderTextColor="#999"
          multiline
          numberOfLines={10}
          textAlignVertical="top"
        />
        <View style={styles.row}>
          <Pressable style={[styles.button, styles.secondary]} onPress={() => { setTitle(''); setContent(''); }}>
            <Text style={[styles.buttonText, { color: Colors.light.primary }]}>Clear</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.primary]} onPress={onSubmit}>
            <Text style={[styles.buttonText, { color: '#fff' }]}>Publish</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  appBar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6 },
  backText: { color: Colors.light.primary, fontWeight: '600' },
  appBarTitle: { color: Colors.light.primary, fontSize: 16, fontWeight: '700' },
  container: { padding: 16, gap: 12 },
  heading: { fontSize: 18, fontWeight: '700', color: Colors.light.primary },
  label: { fontSize: 14, color: '#555', marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e2e2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    color: '#111',
  },
  multiline: { height: 180 },
  row: { flexDirection: 'row', gap: 12, marginTop: 16 },
  button: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: Colors.light.secondary },
  secondary: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  buttonText: { fontSize: 16, fontWeight: '600' },
});
