import { useProfile } from '@/hooks/useProfile';
import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface AvatarPickerProps {
  url?: string | null;
  onPick: (info: { url: string; mediaId?: string } | null) => void;
  size?: number;
  disabled?: boolean;
}

export const AvatarPicker: React.FC<AvatarPickerProps> = ({ url, onPick, size = 88, disabled }) => {
  const { pickAndUploadAvatar } = useProfile(); // local instance; only using pickAndUploadAvatar
  const [busy, setBusy] = React.useState(false);

  const handlePick = async () => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      const res = await pickAndUploadAvatar();
      onPick(res);
    } finally { setBusy(false); }
  };

  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }]}> 
      {url ? (
        <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <View style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }]}> 
          <Text style={styles.placeholderTxt}>Add
            {'\n'}Photo</Text>
        </View>
      )}
      <TouchableOpacity style={styles.overlayBtn} onPress={handlePick} disabled={busy || disabled}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.editTxt}>Edit</Text>}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: 'relative', overflow: 'hidden', backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center' },
  placeholder: { backgroundColor: '#d1d5db', justifyContent: 'center', alignItems: 'center' },
  placeholderTxt: { color: '#374151', fontSize: 12, textAlign: 'center', fontWeight: '600' },
  overlayBtn: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', paddingVertical: 4, alignItems: 'center' },
  editTxt: { color: '#fff', fontSize: 12, fontWeight: '600' },
});

export default AvatarPicker;
