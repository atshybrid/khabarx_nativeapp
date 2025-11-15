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

### 4. Quick JDK Enforcement (without editing gradle.properties)
Prefer NOT hardcoding `org.gradle.java.home` for cross-platform EAS builds. Instead, use either:

```powershell
# One-off session override
$env:JAVA_HOME="C:\Program Files\Java\jdk-17"; $env:Path="C:\Program Files\Java\jdk-17\bin;" + $env:Path

# Or the helper script (recommended)
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
npm run android:dev
```

If it still fails, re-run with diagnostics:
```powershell
./android/gradlew.bat assembleDebug --stacktrace --info
```

### 9. Prebuild vs Checked-in Native Projects
Expo Doctor may warn that config fields won't sync because `android/` is committed. You have two valid strategies:

| Strategy | Pros | Cons |
|----------|------|------|
| Keep `android/` committed (current) | Full manual native control; faster iteration | Must manually reflect app.json changes (icon, orientation, plugins) in native when needed |
| Use Prebuild (gitignore `android/`) | App config stays source of truth; automatic sync | Slower first build; must regenerate after native customizations |

To switch to Prebuild later:
```powershell
git rm -r --cached android
echo '/android' >> .gitignore
npx expo prebuild --clean
```
Then commit and rely on `app.json` for native settings.

For now this project intentionally keeps `android/` committed. Treat doctor’s notice as informational.

### 7. Common Pitfalls
- VS Code reuses an old integrated shell that still has previous PATH.
- Another JDK earlier in PATH (e.g., `C:\Users\<you>\AppData\Local\jdk-11.0.2\bin`). Remove or move it below 17.
- Corporate antivirus locking the new JDK directory (retry after exclusion).

### 8. Fast Sanity Script
Use the provided PowerShell helper: `scripts/use-jdk17.ps1` to ensure a single command runs under the correct JVM without permanently altering your PATH.

---
Keeping builds reproducible: ensure teammates share the same major JDK and Gradle wrapper (checked into version control). Avoid installing multiple vendor JDKs with different major versions unless needed.

## UI Styling Best Practices (Shadows & Text Shadows)

React Native Web now deprecates the granular `shadowColor`, `shadowOpacity`, `shadowRadius`, `shadowOffset`, and text equivalents (`textShadowColor`, etc.) in favor of `boxShadow` / unified `textShadow` on web. To keep styling consistent and silence deprecation warnings, this project uses two helpers:

```ts
// utils/shadow.ts
makeShadow(elevation: number, opts?)
makeTextShadow(x: number, y: number, blur: number, color: string)
```

Usage:
```ts
const styles = StyleSheet.create({
	card: {
		backgroundColor: '#fff',
		borderRadius: 12,
		...makeShadow(6, { opacity: 0.15 })
	},
	title: {
		fontSize: 18,
		fontWeight: '600',
		...makeTextShadow(0,1,2,'rgba(0,0,0,0.35)')
	}
});
```

Why:
- Single source of truth for elevation-like styling across platforms.
- Web automatically gets `boxShadow` / CSS `text-shadow`, native retains classic shadow props + `elevation`.
- Easier future migration if React Native core changes shadow modeling again.

Lint Enforcement:
An ESLint custom rule (`local-rn/no-deprecated-rn-shadows`) warns on direct usage of the deprecated granular props. To intentionally bypass (rarely), you can:
1. Use the helpers instead (preferred).
2. If absolutely necessary (e.g., experimenting), wrap in a file listed in the rule's `allowInFiles` option (update rule config) or refactor once done.

Pointer Events:
React Native Web also deprecates prop-level `pointerEvents`. We now place `pointerEvents` inside style objects when needed: `style={[styles.x, { pointerEvents: 'none' }]}`.

Notifications (Web):
Push token listeners are guarded on web to avoid unsupported listener warnings. The setup returns early from `ensureNotificationsSetup` when `Platform.OS === 'web'`.

If you introduce new UI components with shadows or text shadows, always import and use the helpers to keep consistency and avoid regressions.
