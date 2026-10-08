# E2E Test Infra: Atomic Music Player Fork

## Test Philosophy
- Opaque-box, requirement-driven. Derived from ORIGINAL_REQUEST.md.
- Focus: Branding verification, mobile player bar responsiveness & collision elimination, plugin installation reliability, mobile settings behavior, and Android APK deployment.

## Feature Inventory
| # | Feature | Source (Requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------------|:------:|:------:|:------:|
| 1 | Rebrand App Metadata | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 2 | Android Manifest & Titles | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 3 | UI Strings & Branding | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 4 | Atomic App Icon Assets | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 5 | Fork Documentation (README) | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 6 | Plugin SDK Compatibility Shim | Explorer 1 Survey | 5 | 5 | ✓ |
| 7 | Responsive Player Bar (No Collision) | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 8 | Playback Touch Targets | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 9 | Seek Bar Scrubbing & Touch Area | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 10 | Playback Time Indicators | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 11 | Plugin Installation Timeout | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 12 | Plugin Store Error Handling | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 13 | YouTube Plugin Streaming | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 14 | Plugin Store Card Layout | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 15 | Disambiguate Plugins Navigation | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 16 | Hide Desktop Settings on Mobile | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |
| 17 | Settings Category Filtering | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |
| 18 | Liquid Glass Styling Tokens | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |
| 19 | Android Compilation & Packaging | Acceptance Criteria | 5 | 5 | ✓ |
| 20 | ADB Device Verification (HyperOS) | Acceptance Criteria | 5 | 5 | ✓ |

## Test Architecture
- Test Runners:
  - Vitest / RTL for UI and unit integration: `pnpm test`
  - TypeScript checker: `pnpm type-check`
  - Android APK build & manifest validator: `tauri android build` + `aapt dump badging`
  - ADB runtime smoke test: `adb shell am start` + `adb logcat`
- Test Directory: `packages/player/src/integration-tests/`, `packages/ui/src/components/**/*.test.tsx`

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Target Environment |
|---|----------|--------------------|--------------------|
| 1 | Cold launch & branding check | F1, F2, F3, F4, F5 | Android / Desktop |
| 2 | Mobile portrait playback & scrubbing | F7, F8, F9, F10, F18 | Mobile viewport (360x640) |
| 3 | YouTube plugin install & stream resolve | F6, F11, F12, F13, F14 | App Runtime |
| 4 | Mobile settings navigation & category filter | F15, F16, F17, F18 | Mobile viewport |
| 5 | Full APK installation on Xiaomi HyperOS | F19, F20 | Xiaomi Device Q4PVBIWSHMHUZDAU |
