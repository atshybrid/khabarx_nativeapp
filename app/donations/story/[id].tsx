import LottieLoader from '@/components/ui/LottieLoader';
import { DonationStoryDetail, getDonationStoryById } from '@/services/hrciDonations';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DonationStoryDetails() {
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
      {loading ? (
        <View style={styles.center}> <LottieLoader size={80} /> </View>
      ) : error ? (
        <View style={styles.center}><Text style={{ color: '#b91c1c' }}>{error}</Text></View>
      ) : story ? (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          {/* Images gallery with captions only */}
          {Array.isArray(story.images) && story.images.length > 0 ? (
            <View style={{ gap: 16 }}>
              {story.images
                .slice()
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map((img, idx) => (
                  <View key={img.id || String(idx)} style={styles.galleryItem}>
                    <Image source={{ uri: img.url }} style={styles.galleryImage} contentFit="cover" />
                    {img.caption ? <Text style={styles.caption}>{img.caption}</Text> : null}
                  </View>
                ))}
            </View>
          ) : (
            <View style={styles.center}><Text>No photos available</Text></View>
          )}
        </ScrollView>
      ) : (
        <View style={styles.center}><Text>No story</Text></View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  galleryItem: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#eef0f4', backgroundColor: '#fff' },
  galleryImage: { width: '100%', height: 220, backgroundColor: '#f3f4f6' },
  caption: { color: '#111', padding: 10, fontWeight: '700' },
});
