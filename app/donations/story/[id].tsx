import { DonationStoryDetail, getDonationStoryById } from '@/services/hrciDonations';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DonationStoryDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [story, setStory] = useState<DonationStoryDetail | undefined>(undefined);

  useEffect(() => {
    const run = async () => {
      setLoading(true); setError(null);
      try {
        if (id) {
          const d = await getDonationStoryById(String(id));
          setStory(d);
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load story');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [id]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.iconBtn}>
          <MaterialCommunityIcons name="arrow-left" size={20} color="#111" />
        </Pressable>
        <Text style={styles.headerTitle}>Story</Text>
        <View style={{ width: 44 }} />
      </View>
      {loading ? (
        <View style={styles.center}> <ActivityIndicator /> </View>
      ) : error ? (
        <View style={styles.center}><Text style={{ color: '#b91c1c' }}>{error}</Text></View>
      ) : story ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          {story.heroImageUrl ? (
            <Image source={{ uri: story.heroImageUrl }} style={styles.hero} contentFit="cover" />
          ) : (
            <View style={[styles.hero, { alignItems: 'center', justifyContent: 'center' }]}>
              <MaterialCommunityIcons name="image-off-outline" size={28} color="#9CA3AF" />
            </View>
          )}
          <View style={{ padding: 16 }}>
            <Text style={styles.title}>{story.title}</Text>
            {story.description ? <Text style={styles.desc}>{story.description}</Text> : null}
          </View>
          {Array.isArray(story.images) && story.images.length > 0 ? (
            <View style={{ paddingHorizontal: 16 }}>
              <Text style={styles.sectionTitle}>Photos</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {story.images.map(img => (
                  <Image key={img.id} source={{ uri: img.url }} style={styles.photo} contentFit="cover" />
                ))}
              </ScrollView>
            </View>
          ) : null}
        </ScrollView>
      ) : (
        <View style={styles.center}><Text>No story</Text></View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb' },
  headerTitle: { color: '#111', fontWeight: '900', fontSize: 18 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { width: '100%', height: 200, backgroundColor: '#f3f4f6' },
  title: { color: '#111', fontWeight: '900', fontSize: 18 },
  desc: { color: '#374151', marginTop: 8, lineHeight: 20 },
  sectionTitle: { color: '#111', fontWeight: '900', fontSize: 16, marginBottom: 8 },
  photo: { width: 220, height: 140, borderRadius: 10, backgroundColor: '#f3f4f6' },
});
