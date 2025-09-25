import { Colors } from '@/constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

type PickedLocation = { name: string; lat: number; lng: number } | null;

export default function LocationPickerScreen() {
  const webRef = useRef<WebView>(null);
  const [selected, setSelected] = useState<PickedLocation>(null);
  const [loadingGPS, setLoadingGPS] = useState(false);
  const [webLoading, setWebLoading] = useState(true);
  const [webError, setWebError] = useState<string | null>(null);

  const html = useMemo(() => `<!DOCTYPE html>
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      <style>
        html, body, #map { height: 100%; margin: 0; padding: 0; }
        .searchBox { position: absolute; top: 10px; left: 10px; right: 10px; z-index: 1000; display: flex; gap: 6px; }
        .searchBox input { flex: 1; padding: 10px 12px; border-radius: 10px; border: 1px solid #ddd; font-size: 16px; }
        .searchBox button { padding: 10px 12px; border-radius: 10px; border: 1px solid #ddd; background: #fff; }
        .suggestions { position: absolute; top: 56px; left: 10px; right: 10px; background: #fff; border: 1px solid #eee; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        .suggestions div { padding: 10px 12px; border-bottom: 1px solid #f3f3f3; font-size: 14px; }
        .suggestions div:last-child { border-bottom: none; }
      </style>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    </head>
    <body>
      <div id="map"></div>
      <div class="searchBox">
        <input id="q" placeholder="Search place, city, area" />
        <button id="btn">Search</button>
      </div>
      <div id="sugs" class="suggestions" style="display:none"></div>
      <script>
        const RN = window.ReactNativeWebView;
        let map, marker;
        function init() {
          map = L.map('map').setView([17.385, 78.4867], 5);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap'
          }).addTo(map);
          marker = L.marker([17.385, 78.4867], { draggable: true }).addTo(map);
          marker.on('dragend', async () => {
            const c = marker.getLatLng();
            const name = await reverseName(c.lat, c.lng);
            RN.postMessage(JSON.stringify({ type: 'select', payload: { lat: c.lat, lng: c.lng, name } }));
          });
          map.on('click', async (e) => {
            const { lat, lng } = e.latlng;
            marker.setLatLng(e.latlng);
            const name = await reverseName(lat, lng);
            RN.postMessage(JSON.stringify({ type: 'select', payload: { lat, lng, name } }));
          });
        }
        async function reverseName(lat, lng) {
          try {
            const r = await fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&zoom=14&addressdetails=1', { headers: { 'Accept-Language': 'en' } });
            const j = await r.json();
            return j.display_name || (lat.toFixed(5) + ', ' + lng.toFixed(5));
          } catch (e) {
            return lat.toFixed(5) + ', ' + lng.toFixed(5);
          }
        }
        async function doSearch(q) {
          if (!q) return;
          const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(q) + '&limit=5');
          const list = await r.json();
          const sugs = document.getElementById('sugs');
          sugs.innerHTML = '';
          list.forEach(item => {
            const d = document.createElement('div');
            d.textContent = item.display_name;
            d.onclick = () => {
              sugs.style.display = 'none';
              const lat = parseFloat(item.lat), lng = parseFloat(item.lon);
              map.setView([lat, lng], 14);
              marker.setLatLng([lat, lng]);
              RN.postMessage(JSON.stringify({ type: 'select', payload: { lat, lng, name: item.display_name } }));
            };
            sugs.appendChild(d);
          });
          sugs.style.display = list.length ? 'block' : 'none';
        }
        window.addEventListener('message', (e) => {
          try {
            const msg = JSON.parse(e.data || '{}');
            if (msg.type === 'center') {
              const { lat, lng, name } = msg.payload || {};
              if (lat && lng) {
                map.setView([lat, lng], 14);
                marker.setLatLng([lat, lng]);
                RN.postMessage(JSON.stringify({ type: 'select', payload: { lat, lng, name: name || '' } }));
              }
            }
          } catch (err) {}
        });
        window.onload = () => {
          init();
          const q = document.getElementById('q');
          const btn = document.getElementById('btn');
          q.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') doSearch(q.value); });
          btn.addEventListener('click', () => doSearch(q.value));
        };
      </script>
    </body>
  </html>`, []);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data || '{}');
      if (msg.type === 'select' && msg.payload) {
        setSelected(msg.payload);
      }
    } catch {}
  };

  const handleWebLoad = () => {
    setWebLoading(false);
  };

  const handleWebError = () => {
    setWebLoading(false);
    setWebError('Failed to load map. Check your connection and retry.');
  };

  const retryWeb = () => {
    setWebError(null);
    setWebLoading(true);
    // Force reload by changing key (simpler than injecting script)
    webRef.current?.reload();
  };

  const sendCenterToWeb = (lat: number, lng: number) => {
    const script = `try{ if (window.map && window.marker) { window.map.setView([${lat}, ${lng}], 14); window.marker.setLatLng([${lat}, ${lng}]); } }catch(e){}`;
    webRef.current?.injectJavaScript(script);
  };

  const useCurrentLocation = async () => {
    try {
      setLoadingGPS(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLoadingGPS(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      let name = '';
      try {
        const geos = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        const first = geos[0];
        if (first) {
          name = [first.name, first.subregion, first.region].filter(Boolean).join(', ');
        }
      } catch {}
  setSelected({ lat, lng, name: name || `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
  sendCenterToWeb(lat, lng);
    } finally {
      setLoadingGPS(false);
    }
  };

  const [saving, setSaving] = useState(false);
  const saveAndGoBack = async () => {
    if (!selected || saving) return;
    setSaving(true);
    try {
      // Determine if user is logged in (jwt present)
      const jwt = await AsyncStorage.getItem('jwt');
      // Prepare location object for API
      const locationObj = {
        latitude: selected.lat,
        longitude: selected.lng,
        name: selected.name,
      };
      if (jwt) {
        // Logged in: update user profile
        const { updateUserProfile } = await import('@/services/api');
        await updateUserProfile({ address: { location: locationObj } });
      } else {
        // Guest: update guest registration (location only)
        const { registerGuestUser } = await import('@/services/api');
        // Get languageId and deviceDetails for guest
        let languageId = 'en';
        try {
          const raw = await AsyncStorage.getItem('selectedLanguage');
          if (raw) languageId = JSON.parse(raw)?.id || 'en';
        } catch {}
        let deviceDetails = {};
        try {
          const raw = await AsyncStorage.getItem('deviceDetails');
          if (raw) deviceDetails = JSON.parse(raw);
        } catch {}
  await registerGuestUser({ languageId, deviceDetails, location: { latitude: selected.lat, longitude: selected.lng } });
      }
      await AsyncStorage.setItem('profile_location_obj', JSON.stringify(selected));
      await AsyncStorage.setItem('profile_location', selected.name);
      router.back();
    } catch {
      alert('Failed to update location. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.appBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Select location</Text>
        <View style={{ width: 64, alignItems: 'flex-end' }}>
          <Pressable onPress={saveAndGoBack} disabled={!selected || saving} style={[styles.saveBtn, (!selected || saving) && { opacity: 0.5 }]}> 
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveTxt}>Save</Text>}
          </Pressable>
        </View>
      </View>
      <View style={{ flex: 1 }}>
        {webError ? (
          <View style={styles.errorWrap}>
            <Text style={styles.errorText}>{webError}</Text>
            <Pressable onPress={retryWeb} style={styles.retryBtn}><Text style={styles.retryTxt}>Retry</Text></Pressable>
          </View>
        ) : (
          <>
            <WebView
              ref={webRef}
              source={{ html }}
              onMessage={onMessage}
              originWhitelist={["*"]}
              javaScriptEnabled
              domStorageEnabled
              onLoadEnd={handleWebLoad}
              onError={handleWebError}
            />
            {webLoading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={Colors.light.secondary} />
                <Text style={styles.loadingTxt}>Loading map…</Text>
              </View>
            )}
          </>
        )}
        <View style={styles.floatingBar}>
          <Pressable onPress={useCurrentLocation} style={styles.gpsBtn}>
            {loadingGPS ? <ActivityIndicator color="#fff" /> : <Text style={styles.gpsTxt}>Use current location</Text>}
          </Pressable>
          <View style={styles.selWrap}>
            <Text numberOfLines={2} style={styles.selTxt}>{selected?.name || 'Tap map or search a place'}</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  appBar: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  backBtn: { padding: 8 },
  backTxt: { color: Colors.light.primary, fontWeight: '700' },
  title: { fontSize: 16, fontWeight: '800', color: Colors.light.primary },
  saveBtn: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: Colors.light.secondary, borderRadius: 8 },
  saveTxt: { color: '#fff', fontWeight: '700' },
  floatingBar: { position: 'absolute', left: 10, right: 10, bottom: Platform.select({ ios: 20, android: 20 }), flexDirection: 'row', gap: 8, alignItems: 'center' },
  gpsBtn: { backgroundColor: Colors.light.secondary, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  gpsTxt: { color: '#fff', fontWeight: '700' },
  selWrap: { flex: 1, backgroundColor: '#fff', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  selTxt: { color: '#333' },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.85)', justifyContent: 'center', alignItems: 'center' },
  loadingTxt: { marginTop: 12, color: '#555', fontWeight: '600' },
  errorWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: '#b91c1c', fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Colors.light.secondary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryTxt: { color: '#fff', fontWeight: '700' },
});
