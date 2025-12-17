# Android Release Build (Best Practice)

This guide sets up a proper release keystore and produces a signed APK/AAB.
It also shows how to obtain the SHA‑256 fingerprint for Android App Links.

## 1) Generate a release keystore (one time)

Run in PowerShell from the project root:

```powershell
keytool -genkeypair -v -keystore "android\app\khabarx-release.keystore" -alias khabarx -keyalg RSA -keysize 2048 -validity 10000
```

Remember the passwords and alias you choose.

## 2) Add signing properties (do NOT commit secrets)

Open `android/gradle.properties` (or create local override) and add:

```
MYAPP_UPLOAD_STORE_FILE=android/app/khabarx-release.keystore
MYAPP_UPLOAD_KEY_ALIAS=khabarx
MYAPP_UPLOAD_STORE_PASSWORD=<your_store_password>
MYAPP_UPLOAD_KEY_PASSWORD=<your_key_password>
```

Alternatively, export these as environment variables before building:

- `MYAPP_UPLOAD_STORE_FILE`
- `MYAPP_UPLOAD_KEY_ALIAS`
- `MYAPP_UPLOAD_STORE_PASSWORD`
- `MYAPP_UPLOAD_KEY_PASSWORD`

The Gradle build reads either gradle.properties or environment variables.

## 3) Build release

- APK (signed):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\use-jdk17.ps1 -- .\android\gradlew.bat assembleRelease --no-daemon --stacktrace --console=plain
```

- AAB (for Play Console):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\use-jdk17.ps1 -- .\android\gradlew.bat bundleRelease --no-daemon --stacktrace --console=plain
```

Outputs:
- APK: `android/app/build/outputs/apk/release/app-release.apk`
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`

## 4) Get SHA‑256 (release)

Option A — From the keystore directly:

```powershell
keytool -list -v -alias khabarx -keystore "android\app\khabarx-release.keystore"
```
Copy the value labeled `SHA256:`.

Option B — From Gradle signing report:

```powershell
.\android\gradlew.bat signingReport
```
Look for the `Variant: release` block → `SHA-256`.

## 5) Update server for App Links

In your server environment, set:

```
ANDROID_APP_PACKAGE=com.amoghnya.khabarx
ANDROID_SHA256_DEBUG=<your_debug_fingerprint>
ANDROID_SHA256_RELEASE=<your_release_fingerprint>
```

Your server will serve `/.well-known/assetlinks.json` accordingly.

## 6) Verify App Links on device

```powershell
adb shell pm set-app-links --package com.amoghnya.khabarx verify
adb shell pm get-app-links com.amoghnya.khabarx
```

If a browser opens due to previous defaults, clear defaults for that browser in Android settings.
