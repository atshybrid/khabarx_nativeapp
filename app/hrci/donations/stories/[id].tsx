import EditStorySheet from '@/components/ui/EditStorySheet';
import UploadImageSheet from '@/components/ui/UploadImageSheet';
import { Colors } from '@/constants/Colors';
import { useThemeColor } from '@/hooks/useThemeColor';
import { deleteDonationStoryImage, getDonationStory, type DonationGalleryImage, type DonationStoryDetail } from '@/services/api';
import { emit } from '@/services/events';
import { makeShadow } from '@/utils/shadow';
import { MaterialIcons } from '@expo/vector-icons';
import { BottomSheetBackdrop, BottomSheetModal } from '@gorhom/bottom-sheet';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, FlatList, Image, Platform, Pressable, StatusBar as RNStatusBar, StyleSheet, Text, View } from 'react-native';

export default function DonationStoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bg = useThemeColor({}, 'background');
  const border = useThemeColor({}, 'border');
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'muted');

  const [story, setStory] = React.useState<DonationStoryDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [actionImageId, setActionImageId] = React.useState<string | null>(null);
  const actionSheetRef = React.useRef<BottomSheetModal>(null);

  const load = React.useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await getDonationStory(String(id));
      setStory(res);
    } catch (e) {
      try { console.warn('[StoryDetail] load failed', (e as any)?.message || e); } catch {}
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => { load(); }, [load]);

  const addToGallery = (items: DonationGalleryImage[]) => {
    if (!items?.length) return;
    setStory((prev) => prev ? { ...prev, images: [...items, ...(prev.images || [])] } : prev);
  };

  const galleryWidth = Dimensions.get('window').width - 24;
  const imageSize = (galleryWidth - 8) / 2; // 2 columns with gap
  const topPad = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 0) : 0;

  const closeActionSheet = React.useCallback(() => {
    actionSheetRef.current?.dismiss();
    setTimeout(() => setActionImageId(null), 300);
  }, []);

  const confirmDelete = React.useCallback((imageId: string) => {
    if (!id || !imageId) return;
    Alert.alert(
      'Delete image?',
      'This will remove the image from the gallery.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(imageId);
            try {
              const ok = await deleteDonationStoryImage(String(id), imageId);
              if (ok) {
                setStory(prev => prev ? { ...prev, images: (prev.images || []).filter(img => img.id !== imageId) } : prev);
                emit('toast:show', { message: 'Image deleted' });
              } else {
                emit('toast:show', { message: 'Could not delete image' });
              }
            } catch {
              emit('toast:show', { message: 'Failed to delete image' });
            } finally {
              setDeletingId(null);
              setSelectedId(null);
              closeActionSheet();
            }
          }
        }
      ]
    );
  }, [id, closeActionSheet]);

  const openActionSheet = React.useCallback((imageId: string) => {
    setActionImageId(imageId);
    // If sheet available, present; otherwise fallback to direct confirm
    requestAnimationFrame(() => {
      if (actionSheetRef.current) {
        actionSheetRef.current.present();
      } else {
        // fallback: direct confirm
        Alert.alert(
          'Delete image?',
          'This will remove the image from the gallery.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(imageId) },
          ]
        );
      }
    });
  }, [confirmDelete]);

  

  // Simple skeleton box with pulsing opacity
  const SkeletonBox: React.FC<{ width: number | string; height: number; radius?: number }>
    = ({ width, height, radius = 10 }) => {
    const pulse = React.useRef(new Animated.Value(0.6)).current;
    React.useEffect(() => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0.6, duration: 700, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => { loop.stop(); };
    }, [pulse]);
    return (
      <Animated.View
        style={[
          { height, borderRadius: radius, backgroundColor: '#E6E6E6', opacity: pulse },
          typeof width === 'number' ? { width } : ({ width } as any),
        ]}
      />
    );
  };

  // Lightweight lazy-loading thumbnail with fade-in
  const GalleryThumb: React.FC<{ uri: string; size: number }> = ({ uri, size }) => {
    const [loaded, setLoaded] = React.useState(false);
    const opacity = React.useRef(new Animated.Value(0.15)).current;
    const onLoadEnd = React.useCallback(() => {
      setLoaded(true);
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    }, [opacity]);
    return (
      <View style={{ width: size, height: size, borderRadius: 10, overflow: 'hidden', backgroundColor: 'transparent' }}>
        {!loaded && (
          <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
            <SkeletonBox width={'100%'} height={size} radius={10} />
          </View>
        )}
        <Animated.Image source={{ uri }} onLoadEnd={onLoadEnd} style={{ width: '100%', height: '100%', opacity }} resizeMode="cover" />
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: bg, paddingTop: topPad }}>
      {loading || !story ? (
        <FlatList
          data={Array.from({ length: 6 }).map((_, i) => `s${i}`)}
          keyExtractor={(k) => k}
          numColumns={2}
          columnWrapperStyle={{ gap: 8 }}
          renderItem={() => (
            <View style={{ width: imageSize, marginBottom: 8 }}>
              <SkeletonBox width={imageSize} height={imageSize} radius={10} />
              <View style={{ height: 6 }} />
              <SkeletonBox width={imageSize * 0.7} height={12} radius={6} />
            </View>
          )}
          contentContainerStyle={{ padding: 12, paddingBottom: 80, gap: 8 }}
          ListHeaderComponent={() => (
            <View>
              <SkeletonBox width={'100%'} height={200} radius={12} />
              <View style={{ height: 10 }} />
              <SkeletonBox width={'70%'} height={18} radius={8} />
              <View style={{ height: 6 }} />
              <SkeletonBox width={'90%'} height={12} radius={6} />
              <View style={{ height: 6 }} />
              <SkeletonBox width={'60%'} height={12} radius={6} />
              <View style={{ height: 14 }} />
              <SkeletonBox width={'30%'} height={16} radius={8} />
            </View>
          )}
        />
      ) : (
        <FlatList
          data={story.images || []}
          keyExtractor={(it) => it.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 8 }}
          renderItem={({ item }) => (
            <View style={{ width: imageSize, marginBottom: 8 }}>
              <View style={{ position: 'relative' }}>
                <Pressable
                  onPress={() => {
                    if (selectedId === item.id) setSelectedId(null); else openActionSheet(item.id);
                  }}
                  onLongPress={() => setSelectedId(item.id)}
                  delayLongPress={250}
                  disabled={deletingId === item.id}
                  style={({ pressed }) => ({ opacity: pressed ? 0.96 : 1 })}
                >
                  <GalleryThumb uri={item.url} size={imageSize} />
                </Pressable>
                {selectedId === item.id ? (
                  <>
                    <View pointerEvents="none" style={styles.selectionOverlay} />
                    <Pressable
                      onPress={() => confirmDelete(item.id)}
                      disabled={deletingId === item.id}
                      style={({ pressed }) => [styles.deleteCorner, pressed && { opacity: 0.9 }]}
                    >
                      {deletingId === item.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <MaterialIcons name="delete" size={18} color="#fff" />
                      )}
                    </Pressable>
                  </>
                ) : null}
              </View>
              {item.caption ? <Text style={[styles.caption, { color: muted }]} numberOfLines={1}>{item.caption}</Text> : null}
            </View>
          )}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={7}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews
          onScrollBeginDrag={() => setSelectedId(null)}
          contentContainerStyle={{ padding: 12, paddingBottom: 80, gap: 8 }}
          ListHeaderComponent={() => (
            <View>
              <Image source={{ uri: story.heroImageUrl || 'https://via.placeholder.com/800x450?text=Story' }} style={styles.hero} />
              <Text style={[styles.title, { color: text }]}>{story.title}</Text>
              {story.description ? <Text style={[styles.desc, { color: muted }]}>{story.description}</Text> : null}
              <View style={[styles.section, { borderColor: border }]}>
                <Text style={[styles.sectionTitle, { color: text }]}>Gallery</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={{ color: muted }}>No images yet</Text>}
        />
      )}

      {/* FAB */}
      <Pressable onPress={() => setSheetOpen(true)} style={({ pressed }) => [styles.fab, { backgroundColor: Colors.light.secondary }, pressed && { opacity: 0.9 }]}>
        <MaterialIcons name="add-a-photo" size={22} color="#fff" />
      </Pressable>

      {/* Edit FAB (stacked slightly above) */}
      <Pressable onPress={() => setEditOpen(true)} style={({ pressed }) => [styles.fab, { bottom: 88, backgroundColor: Colors.light.primary }, pressed && { opacity: 0.9 }]}>
        <MaterialIcons name="edit" size={22} color="#fff" />
      </Pressable>

      <UploadImageSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} storyId={String(id || '')} onUploaded={addToGallery} />
      <EditStorySheet
        visible={editOpen}
        story={story}
        onClose={() => setEditOpen(false)}
        onUpdated={(s) => {
          setStory(s);
          setEditOpen(false);
        }}
      />

      {/* Action sheet for image options */}
      <BottomSheetModal
        ref={actionSheetRef}
        index={0}
        snapPoints={[160] as any}
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
        )}
        onDismiss={() => setActionImageId(null)}
      >
        <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
          <Text style={[styles.sheetTitle, { color: text }]}>Image options</Text>
          <Pressable
            onPress={() => actionImageId && confirmDelete(actionImageId)}
            disabled={!actionImageId || (deletingId != null)}
            style={({ pressed }) => [styles.sheetRow, pressed && { opacity: 0.85 }]}
          >
            {deletingId && actionImageId === deletingId ? (
              <ActivityIndicator size="small" color="#d00" style={{ marginRight: 10 }} />
            ) : (
              <MaterialIcons name="delete-outline" size={20} color="#d00" style={{ marginRight: 10 }} />
            )}
            <Text style={[styles.sheetRowTextDelete]}>Delete image</Text>
          </Pressable>
          <Pressable onPress={closeActionSheet} style={({ pressed }) => [styles.sheetRow, pressed && { opacity: 0.85 }]}>
            <MaterialIcons name="close" size={20} color={text} style={{ marginRight: 10 }} />
            <Text style={[styles.sheetRowText, { color: text }]}>Cancel</Text>
          </Pressable>
        </View>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', height: 200, borderRadius: 12, backgroundColor: '#eee' },
  title: { fontSize: 20, fontWeight: '800', marginTop: 10 },
  desc: { marginTop: 6 },
  section: { marginTop: 14, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  caption: { fontSize: 12, marginTop: 4 },
  fab: { position: 'absolute', right: 16, bottom: 20, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', ...makeShadow(6, { opacity: 0.18, y: 4, blur: 16 }) },
  sheetTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  sheetRowText: { fontSize: 15 },
  sheetRowTextDelete: { fontSize: 15, color: '#d00', fontWeight: '700' },
  selectionOverlay: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(208,0,0,0.18)', borderRadius: 10 },
  deleteCorner: { position: 'absolute', right: 10, top: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: '#d00', alignItems: 'center', justifyContent: 'center', ...makeShadow(4, { opacity: 0.25, y: 2, blur: 8 }) },
});
