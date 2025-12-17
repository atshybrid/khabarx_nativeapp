# Android App Links: Make HTTPS open the app

If tapping a Read: https://app.hrcitodaynews.in/... link opens the website instead of the app, Android hasn’t verified the domain → app association yet.

This guide explains how to verify Android App Links so HTTPS links open directly in the app.

## 1) Confirm manifest is configured
The intent filter is already present in `android/app/src/main/AndroidManifest.xml`:

```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW"/>
  <category android:name="android.intent.category.DEFAULT"/>
  <category android:name="android.intent.category.BROWSABLE"/>
  <data android:scheme="https" android:host="app.hrcitodaynews.in"/>
</intent-filter>
```

## 2) Host Digital Asset Links JSON on your domain
Android will only open the app for HTTPS links after it verifies a JSON file hosted by your domain.

- URL: `https://app.hrcitodaynews.in/.well-known/assetlinks.json`
- Content-Type: `application/json`
- No redirects; must return HTTP 200

Template (replace the fingerprint below with your actual SHA‑256):

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "org.hrci.khabarx",
      "sha256_cert_fingerprints": [
        "AA:BB:CC:DD:EE:FF:...:ZZ" 
      ]
    }
  }
]
```

You can list multiple fingerprints (debug and release) in the array while testing.

### Get your SHA‑256 fingerprint(s)
- Debug build (used by `npx expo run:android`):

```powershell
keytool -list -v -alias androiddebugkey -keystore "android\app\debug.keystore" -storepass android -keypass android
```

- Release build (replace with your keystore, alias, and passwords):

```powershell
keytool -list -v -alias <your_release_alias> -keystore "<path_to_release_keystore>"
```

Copy the full value for `SHA256:` (with colons) into the JSON.

## 3) Force verification on device
After hosting `assetlinks.json`, reinstall or trigger verification:

```powershell
adb shell pm clear com.android.chrome
adb shell pm set-app-links --package org.hrci.khabarx verify
adb shell pm get-app-links org.hrci.khabarx
```

You can also check in Settings → Apps → Khabarx → Open by default → Verified links. The domain should appear as Verified.

Note: If you previously chose a browser as default for this domain, clear defaults for that browser app.

## 4) Retest a link
Try tapping a link like:

```
https://app.hrcitodaynews.in/te/short/prcuuruloo-vrd-prbhaavn-prbhutv-bhroosaa-233603
```

- If verified: it should open the Khabarx app directly.
- If not verified: Android will open the browser (or show a chooser).

## 5) About slugs vs IDs
The app’s deep‑link handler extracts the trailing ID from the slug and routes to `/article/[id]`. For example, the last segment `...-233603` maps to `id = 233603`.

Ensure your backend supports fetching the article by that ID (the app tries `/shortnews/{id}`, `/shortnews/item?id={id}`, `/news/{id}`).

## 6) WhatsApp note
WhatsApp only auto‑links HTTPS. That’s why we removed `khabarx://...` from the caption. Once App Links are verified, tapping the HTTPS link in WhatsApp opens the app.
