# Project: Atomic Music Player (Mobile-First Fork)

## Architecture
Atomic is an open-source mobile-first music player fork of Nuclear Music Player, optimized for Android and desktop.
- **Frontend Core**: React 19, TypeScript, Vite, Tailwind CSS v4 (liquid glass aesthetic with frosted backdrop blurs and glowing translucent surfaces).
- **Backend / Host Bridge**: Tauri v2 (Rust cdylib `app_lib`), Kotlin Android integration (`HyperIslandNotificationManager.kt`, `NuclearMediaService.kt`, `MainActivity.kt`), and local streaming proxies.
- **State & Stores**: Zustand persistent stores, TanStack Query v5 for API caching, TanStack Router client navigation.
- **Plugin System**: `@nuclearplayer/plugin-sdk` runtime execution sandbox (`PluginLoader.ts`), marketplace client (`pluginMarketplaceApi.ts`), esbuild compiler (`pluginCompiler.ts`), and local storage.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Rebrand App Metadata | Update app name, product name, binary, window title, and descriptions across tauri.conf.json, package.json, Cargo.toml, index.html | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Android Manifest & Titles | Update strings.xml (`app_name`, `main_activity_title`) so launcher and app switcher display "Atomic" | M1 | ORIGINAL_REQUEST §R1 |
| 3 | UI Strings & Branding | Update i18n locales (`en_US.json`) and UI components (`ConnectedTopBar`, `ConnectedTitleBar`) to "Atomic" | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Atomic App Icon | Design & integrate atomic energy vector logo, Tauri icons, and Android adaptive/mipmap icons | M1 | ORIGINAL_REQUEST §R1 |
| 5 | Fork Documentation | Update README.md documenting Atomic as an open-source mobile-first fork of Nuclear | M1 | ORIGINAL_REQUEST §R1 |
| 6 | Plugin SDK Compatibility Shim | Maintain `@nuclearplayer/plugin-sdk` in PluginLoader and compiler so existing store plugins load without breakages | M1 | Explorer 1 Survey |
| 7 | Responsive Player Bar | Redesign PlayerBarRoot to prevent overlapping between center controls and right volume controls on mobile viewports (<640px) | M2 | ORIGINAL_REQUEST §R2 |
| 8 | Playback Touch Targets | Ensure all controls (play/pause, skip, shuffle, repeat, mute/volume) have comfortable, separated touch targets | M2 | ORIGINAL_REQUEST §R2 |
| 9 | Interactive Seek Bar & Scrubbing | Expand touch hit-slop to >=36px and implement pointer capture dragging in useSeekBar | M2 | ORIGINAL_REQUEST §R2 |
| 10 | Playback Time Indicators | Relocate elapsed/remaining time indicators outside track to ensure high contrast and readability | M2 | ORIGINAL_REQUEST §R2 |
| 11 | Plugin Installation Timeout & Proxy | Add AbortSignal timeout and Tauri http proxy support to ApiClient.fetch to prevent indefinite "installing" hangs | M3 | ORIGINAL_REQUEST §R3 |
| 12 | Plugin Store Error Handling | Fix silent error swallowing in `loadPluginFromPath` and add robust retry/cleanup in `useInstallPlugin` | M3 | ORIGINAL_REQUEST §R3 |
| 13 | YouTube Plugin Streaming | Verify YouTube streaming plugin installation, activation, and stream playback | M3 | ORIGINAL_REQUEST §R3 |
| 14 | Plugin Store Card Layout | Add responsive wrapping and flex structure to PluginStoreItem so badges and buttons don't stack awkwardly | M3 | ORIGINAL_REQUEST §R3 |
| 15 | Disambiguate Plugins Navigation | Clearly separate "Plugin Preferences" in Settings from "Installed Plugins" and "Plugin Store" in App Navigation | M3 | ORIGINAL_REQUEST §R3 |
| 16 | Hide Desktop Settings on Mobile | Exclude frameless window, custom title bar, and title bar style toggles when platform is Android | M4 | ORIGINAL_REQUEST §R4 |
| 17 | Settings Category Filtering | Fix category pill selection so clicking a pill filters exclusively to that category without bouncing back to General | M4 | ORIGINAL_REQUEST §R4 |
| 18 | Liquid Glass Aesthetics | Implement translucent surfaces, frosted backdrop blurs (`backdrop-blur-xl`), glowing borders, and fluid animations | M4 | ORIGINAL_REQUEST §R4 |
| 19 | Android Compilation & Packaging | Configure local.properties, build universal debug APK with `tauri android build` | M5 | ORIGINAL_REQUEST Acceptance Criteria |
| 20 | ADB Xiaomi Device Verification | Deploy APK to connected Xiaomi HyperOS 3 device (`24094RAD4G`) and verify end-to-end functionality | M5 | ORIGINAL_REQUEST Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Rebrand Fork as "Atomic" | Features 1–6: Metadata, Android strings, UI strings, atomic icons, README, SDK shim | None | IN_PROGRESS |
| M2 | Player Bar & Touch Controls | Features 7–10: Responsive layout, non-overlapping controls, seek bar scrubbing & time display | None | IN_PROGRESS |
| M3 | Plugin Store & YouTube Plugin | Features 11–15: Install timeout fix, error rethrow, store card layout, nav disambiguation | None | PLANNED |
| M4 | Mobile Settings & Liquid Glass | Features 16–18: Mobile settings filtering, desktop toggle exclusion, liquid glass design tokens | M1, M2 | PLANNED |
| M5 | Android Build & Final Verification | Features 19–20: Gradle build, APK packaging, ADB deployment on Xiaomi device, full acceptance audit | M1, M2, M3, M4 | PLANNED |

## Code Layout
- `packages/player/src-tauri/tauri.conf.json` — Tauri application configuration & metadata
- `packages/player/src-tauri/gen/android/` — Android native Gradle project, manifests, resources
- `packages/i18n/src/locales/en_US.json` — Application internationalization strings
- `packages/ui/src/components/PlayerBar/` — PlayerBarRoot, PlayerBarControls, PlayerBarVolume, PlayerBarSeekBar
- `packages/ui/src/components/PluginStoreItem/` — PluginStoreItem card component
- `packages/player/src/views/Plugins/` — PluginStore, InstalledPlugins views
- `packages/player/src/apis/ApiClient.ts` — HTTP client with timeout & Tauri proxy
- `packages/player/src/stores/pluginStore.tsx` — Plugin state store & lifecycle management
- `packages/player/src/views/Settings/` — Settings view, category filtering, scrollspy
- `packages/player/src/services/coreSettings.ts` — Settings definitions & platform filters
- `packages/tailwind-config/` — Global styling, liquid glass utility tokens

## Interface Contracts
### PlayerBarRoot Responsive Contract
- Props: `left?: ReactNode; center?: ReactNode; right?: ReactNode; className?: string`
- Desktop (`>= 768px`): 3-column grid `[minmax(0,1fr)_auto_minmax(0,1fr)]` inside `h-16`.
- Mobile (`< 768px`): Multi-row flex container. NowPlaying on top or integrated; Center controls on dedicated row with 44px touch targets; Volume/Mute controls on clean lower/inline zone without spatial overlap.

### Settings Category Filtering Contract
- `Settings`: Accepts `activeCategory?: string`. When provided, filters `visibleGroups = groups.filter(g => g.name === activeCategory)`.
- `ViewShell title`: Dynamically renders `t(`${activeGroup.name}.title`, activeGroup.name)` instead of hardcoded General.
- Platform Detection: `useSettingsGroups` reads `platform` from `PlatformProvider`. If `platform === 'android' || platform === 'ios'`, excludes settings in `DESKTOP_ONLY_SETTINGS`.

### Plugin Installation Contract
- `ApiClient.fetch(path, schema, options)`: Must include `AbortSignal.timeout(15000)`. Must catch network errors and throw descriptive `ApiError`.
- `pluginStore.loadPluginFromPath(path)`: If loading fails, rethrows error so mutation caller receives rejection and resets `isPending`.
