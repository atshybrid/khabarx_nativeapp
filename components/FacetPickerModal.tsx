import React from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export interface FacetItem { id: string; name: string; code?: string }

interface FacetPickerModalProps {
  visible: boolean;
  title: string;
  items: FacetItem[];
  selectedId?: string;
  loading?: boolean;
  onSelect: (id: string | undefined) => void;
  onClose: () => void;
  allowClear?: boolean;
}

const FacetPickerModal: React.FC<FacetPickerModalProps> = ({ visible, title, items, selectedId, loading, onSelect, onClose, allowClear }) => {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close picker"><Text style={styles.closeText}>✕</Text></Pressable>
          </View>
          {loading ? (
            <View style={styles.loadingWrap}><ActivityIndicator /></View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const active = item.id === selectedId;
                return (
                  <Pressable
                    onPress={() => { onSelect(item.id); onClose(); }}
                    style={[styles.row, active && styles.rowActive]}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${item.name}`}
                  >
                    <Text style={[styles.rowText, active && styles.rowTextActive]} numberOfLines={1}>{item.name}</Text>
                    {active && <Text style={styles.check}>✓</Text>}
                  </Pressable>
                );
              }}
              ListEmptyComponent={<Text style={styles.empty}>No items</Text>}
            />
          )}
          {allowClear && (
            <Pressable style={styles.clearBtn} onPress={() => { onSelect(undefined); onClose(); }}>
              <Text style={styles.clearText}>Clear Selection</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#ffffff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', paddingBottom: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  closeBtn: { padding: 8, borderRadius: 16 },
  closeText: { fontSize: 18, color: '#334155' },
  loadingWrap: { padding: 24, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 20 },
  rowActive: { backgroundColor: '#f1f5f9' },
  rowText: { fontSize: 15, color: '#334155', flex: 1, marginRight: 12 },
  rowTextActive: { fontWeight: '700' },
  check: { fontSize: 16, color: '#2563eb', fontWeight: '700' },
  empty: { textAlign: 'center', padding: 24, color: '#64748b' },
  clearBtn: { marginTop: 4, marginHorizontal: 20, paddingVertical: 12, alignItems: 'center', backgroundColor: '#e2e8f0', borderRadius: 12 },
  clearText: { fontSize: 14, fontWeight: '600', color: '#334155' },
});

export default FacetPickerModal;
