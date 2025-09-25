> Edited for use in IDX on 07/09/12

# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Project Setup

When you clone this repository or set it up on a new machine (like a server), you need to install all the project dependencies. Run the following command in the project's root directory:

```bash
npm install
```

This will download all the necessary packages and create the `node_modules` folder. After this, you can run the application using the commands below.

## Get started

#### Android

Android previews are defined as a `workspace.onStart` hook and started as a vscode task when the workspace is opened/started.

Note, if you can't find the task, either:
- Rebuild the environment (using command palette: `IDX: Rebuild Environment`), or
- Run `npm run android -- --tunnel` command manually run android and see the output in your terminal. The device should pick up this new command and switch to start displaying the output from it.

In the output of this command/task, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You'll also find options to open the app's developer menu, reload the app, and more.

#### Web

Web previews will be started and managred automatically. Use the toolbar to manually refresh.

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Android Build: Java & Gradle Best Practices

This project targets Android Gradle Plugin versions that require Java 17. If you see errors like "This build requires JDK 17" but your system reports Java 11 or 24, follow these steps.

### 1. Install an LTS JDK (17)
Install a vendor build (Temurin, Microsoft, Oracle, or Zulu) to: `C:\Program Files\Java\jdk-17`.

### 2. Set System Environment Variables (Windows)
Use Windows Settings > System > About > Advanced System Settings > Environment Variables:
User + System variables:
- JAVA_HOME = `C:\Program Files\Java\jdk-17`
- Add (or move to top) `C:\Program Files\Java\jdk-17\bin` in PATH (remove older `jdk-11` or `jdk-24` entries for build shells).

Close and reopen terminals.

### 3. Verify
```powershell
java -version
where java
```
Should show only paths inside `jdk-17`.

### 4. Gradle Wrapper Enforcement
We also set `org.gradle.java.home` in `android/gradle.properties` as a fallback. If Gradle still launches with the wrong JVM, run via the helper script:

```powershell
powershell -File scripts/use-jdk17.ps1 -- ./android/gradlew.bat -v
```

### 5. Clean Caches (after switching JDK)
```powershell
./android/gradlew.bat --stop
Remove-Item -Recurse -Force .\android\.gradle
```
Optionally clear `%USERPROFILE%/.gradle/caches` (will force dependency re-download).

### 6. Rebuild
```powershell
npx expo run:android
```

If it still fails, re-run with diagnostics:
```powershell
./android/gradlew.bat assembleDebug --stacktrace --info
```

### 7. Common Pitfalls
- VS Code reuses an old integrated shell that still has previous PATH.
- Another JDK earlier in PATH (e.g., `C:\Users\<you>\AppData\Local\jdk-11.0.2\bin`). Remove or move it below 17.
- Corporate antivirus locking the new JDK directory (retry after exclusion).

### 8. Fast Sanity Script
Use the provided PowerShell helper: `scripts/use-jdk17.ps1` to ensure a single command runs under the correct JVM without permanently altering your PATH.

---
Keeping builds reproducible: ensure teammates share the same major JDK and Gradle wrapper (checked into version control). Avoid installing multiple vendor JDKs with different major versions unless needed.

## Preferences: Language & Location Management

The app maintains user/device preferences via the backend `/preferences` endpoints and a local cache. Two primary user-editable preferences now surface in the Account screen:

### Location Preference
1. Current value shown (human readable place name if available; otherwise coordinates).
2. Change workflow:
	- Tap "Change" → opens map picker (`/settings/location`).
	- Select via map click, drag marker, search, or Use Current Location (GPS).
	- Press Save in picker → stores a draft locally (AsyncStorage key: `profile_location_obj`) and returns to Account.
	- Account screen shows an "Unsaved selection" banner; user taps Save to push to backend.
3. GPS Refresh (no draft present): directly fetches device coords + reverse geocode and updates backend.
4. Redundant Updates Avoided: If draft or GPS result matches backend (lat, lng, placeName), the update is skipped with a friendly inline message.
5. Last Updated label reflects `prefs.updatedAt` (Server timestamp or fallback to client set time stored after update).

### Language Preference
1. Language card shows current language (native name prioritized).
2. Change workflow:
	- Tap "Change" → lazy-loads languages (cached or `/languages` endpoint) into a bottom sheet selector.
	- Tap a language → calls `updateLanguage` (from `usePreferences` hook) which:
	  - Sends selective intent payload to `/preferences/update`.
	  - Refreshes first page of news/articles for the new language.
	  - Persists selection (`selectedLanguage` AsyncStorage helper) for startup.
3. Selecting the already active language short-circuits with a success inline message and **no** network call.
4. Inline success/error messages appear in the Account screen (shared messaging area with location updates) and can be extended later to auto-dismiss.

### Technical Notes
| Concern | Implementation |
|---------|----------------|
| Selective updates | Intent-based payload builder only includes fields being changed (pushToken, languageId, or location). |
| Local cache | Cached record saved under `preferences_cache_v1`; loaded first for fast UI hydration. |
| Draft vs backend comparison | Epsilon comparison (1e-6) on lat/lng plus placeName/name equality to suppress redundant saves. |
| News refresh on language change | Triggered automatically inside `usePreferences.updateLanguage` after successful update. |
| AsyncStorage keys | `preferences_cache_v1`, `profile_location_obj`, `selectedLanguage`, push token & auth tokens separately. |
| Error handling | Inline message area + console warnings; map picker has retry UI for WebView load failures. |

### Extending Further (Future Ideas)
* Add notification preference toggle (enable/disable push channel) using same intent model.
* Auto-dismiss inline success messages after ~3 seconds.
* Provide permission status badges (Location / Notifications) in Account screen.
* Batch multi-field updates (language + location) via `updateMultiple` for fewer network round trips.
* Track and display distance change when updating location (use haversine formula) for user context.

---
For questions about the preference system, see `services/preferences.ts` and `hooks/usePreferences.ts` for the authoritative logic.

## Profile Editing & Legal Screens

The Account page now includes a Profile section with basic editable fields and links to Terms & Conditions and Privacy Policy screens.

### Features
* Avatar upload (image picker → `uploadMedia` → sets `profilePhotoUrl` & `profilePhotoMediaId`).
* Editable Full Name & Bio fields (optimistic local state with dirty tracking).
* Save button appears only when changes differ from last loaded snapshot.
* Lightweight `useProfile` hook manages:
	- Initial load via `getUserProfile` (gracefully handles first-time users with no profile yet).
	- Local modifications (`updateLocal`).
	- Avatar selection + upload (`pickAndUploadAvatar`).
	- Save operation merges and persists via `updateUserProfile` (PATCH with fallback logic inside API layer).
* Inline error surfacing (profile load/save/upload) using hook `error` state.
* Legal pages (`/settings/terms` and `/settings/privacy`) are simple scrollable static placeholder documents—replace with real content from counsel.

### Key Files
| File | Purpose |
|------|---------|
| `hooks/useProfile.ts` | Encapsulates profile load/save, dirty detection, avatar upload helper. |
| `components/AvatarPicker.tsx` | Reusable avatar component with edit overlay and upload progress indicator. |
| `app/settings/account.tsx` | Integrates Profile section alongside Location & Language preferences. |
| `app/settings/terms.tsx` | Placeholder Terms & Conditions screen. |
| `app/settings/privacy.tsx` | Placeholder Privacy Policy screen. |

### Data Flow
1. Account screen mounts → `useProfile` loads current profile (GET `/profiles/me`).
2. User edits name/bio or updates avatar → local state updated & dirty flag recalculated.
3. Save → `updateUserProfile` performs GET merge + PATCH (or POST if profile absent) ensuring backward compatible server semantics.
4. On success snapshot resets → Save button disappears.

### Avatar Upload Strategy
`uploadMedia` attempts multiple form field strategies (`file`, `image`, `media`, `files[]`) to maximize backend compatibility. Successful uploads are cached by local URI to avoid duplicate uploads during the same session.

### Extending Profile
Add more fields to the `fields` array in `useProfile.save` and corresponding UI inputs (e.g., gender, dob, occupation). All unmodified fields remain untouched server-side due to merge logic.

### Future Enhancements (Ideas)
* Field-level validation (DOB format, max bio length, restricted characters).
* Optimistic save to show immediate success toast while network completes.
* Graceful retry queue for offline edits (persist patch diff until connectivity returns).
* Central toast system integration for consistent messaging (see existing Toast component patterns if/when added).
* Add a dedicated Account / Legal section in navigation for store review compliance.

---

## Debug: Inspecting Local Storage

Use the Account Debug screen (`/settings/account-debug`) to introspect AsyncStorage during development:

Buttons added:
* "Dump All Storage to Log" – prints every key (and truncated values) with size metrics.
* "Dump News Cache Keys" – filters to keys beginning with `news_cache:`.
* "Show Preferences Cache" – logs the raw `preferences_cache_v1` value.
* "Storage Health Check" – summary of total keys and those matching cache/token/pref/news patterns.

Underlying helpers live in `services/debugStorage.ts`:
* `logAllStorage({ includeValues, maxValueLength, filterPrefix })`
* `logStorageKey(key)`
* `removeStorageKey(key)`
* `storageHealthCheck()`

These are safe in production (no build-time stripping currently) but should not surface in user-facing navigation for release builds.

