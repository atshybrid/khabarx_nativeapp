import { getUserProfile, updateUserProfile, UploadedMedia, uploadMedia, UserProfileResponse, UserProfileUpdateInput } from '@/services/api';
import { requestMediaPermissionsOnly } from '@/services/permissions';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseProfileState {
  profile: UserProfileResponse | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  dirty: boolean;
  pickAndUploadAvatar: () => Promise<{ url: string; mediaId?: string } | null>;
  updateLocal: (patch: Partial<UserProfileUpdateInput>) => void;
  save: () => Promise<UserProfileResponse | null>;
  reset: () => void;
  refetch: () => Promise<void>;
}

// Simple shallow compare to decide dirtiness
function isDirty(base: any, current: any): boolean {
  if (!base && current) return true;
  if (!current && base) return true;
  const keys = new Set([...(Object.keys(base || {})), ...(Object.keys(current || {}))]);
  for (const k of keys) {
    if ((base as any)?.[k] !== (current as any)?.[k]) return true;
  }
  return false;
}

export function useProfile(): UseProfileState {
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [snapshot, setSnapshot] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true; setLoading(true); setError(null);
    try {
      const p = await getUserProfile();
      setProfile(p);
      setSnapshot(p);
      console.log('[PROFILE] loaded', p ? Object.keys(p) : 'empty');
    } catch (e: any) {
      setError(e?.message || 'Failed to load profile');
      console.warn('[PROFILE] load failed', e);
    } finally { inFlight.current = false; setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateLocal = useCallback((patch: Partial<UserProfileUpdateInput>) => {
    setProfile(prev => ({ ...(prev || {}), ...patch }));
  }, []);

  const save = useCallback(async () => {
    if (saving) return null;
    setSaving(true); setError(null);
    try {
      const partial: UserProfileUpdateInput = {};
      // Only include fields present in current profile (avoid sending unrelated large objects)
      const cur: any = profile || {};
      const fields = ['fullName','gender','dob','maritalStatus','bio','profilePhotoUrl','profilePhotoMediaId','emergencyContactNumber','address','stateId','districtId','assemblyId','mandalId','villageId','occupation','education','socialLinks'];
      for (const f of fields) {
        if (f in cur) (partial as any)[f] = cur[f];
      }
      const saved = await updateUserProfile(partial);
      setProfile(saved); setSnapshot(saved);
      console.log('[PROFILE] save success');
      return saved;
    } catch (e: any) {
      setError(e?.message || 'Failed to save profile');
      console.warn('[PROFILE] save failed', e);
      return null;
    } finally {
      setSaving(false);
    }
  }, [profile, saving]);

  const pickAndUploadAvatar = useCallback(async () => {
    try {
      // Ensure permission
      await requestMediaPermissionsOnly();
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.8,
      });
      if (res.canceled) return null;
      const asset = res.assets?.[0];
      if (!asset?.uri) return null;
      console.log('[PROFILE] avatar picked', asset.uri);
      const uploaded: UploadedMedia = await uploadMedia({ uri: asset.uri, type: 'image', name: asset.fileName || 'avatar.jpg', folder: 'avatars' });
      updateLocal({ profilePhotoUrl: uploaded.url, profilePhotoMediaId: uploaded.id });
      console.log('[PROFILE] avatar upload success', { mediaId: uploaded.id });
      return { url: uploaded.url, mediaId: uploaded.id };
    } catch (e: any) {
      console.warn('[PROFILE] avatar upload failed', e?.message || e);
      setError(e?.message || 'Avatar upload failed');
      return null;
    }
  }, [updateLocal]);

  const dirty = isDirty(snapshot || {}, profile || {});

  return {
    profile,
    loading,
    saving,
    error,
    dirty,
    pickAndUploadAvatar,
    updateLocal,
    save,
    reset: () => { setProfile(snapshot); },
    refetch: load,
  };
}
