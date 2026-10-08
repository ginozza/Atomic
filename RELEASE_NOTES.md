# Atomic v1.49.1 (Android)

Free, open-source, and privacy-first music player for Android without ads or tracking.

## Highlights & What's New

### 🚀 New Features / Nuevas Características
- Atomic Android: Dedicated mobile touch UI with liquid-glass bottom navigation bar, floating mini-player, and swipe-down Now Playing sheet. `[Android]` `[UI]` *(2026-10-08)*
- Native Android integration: Hardware back button navigation, Xiaomi HyperOS 3 Super Island dynamic notifications, and MediaSession lockscreen controls. `[Android]` `[Integrations]` *(2026-10-08)*
- Stream verification is back. Now with offline verification `[Streaming]` `[Queue]` *(2026-09-22)*
- Theming system v2: themes can now use gradients on surfaces, and a whole new group of variables to make Nuclear more customizable. See the docs and release notes for details. `[UI]` `[Themes]` *(2026-09-01)*
- Clickable artist/track title in the player bar `[UI]` *(2026-08-29)*

### ⚡ Improvements / Mejoras
- Resilient mobile audio engine: YouTube stream fallback with inline iframe, background playback stability, and next-track prefetching. `[Playback]` `[Streaming]` *(2026-10-08)*
- Automated Android APK CI/CD pipeline building optimized ARM64 and universal APK releases. `[Android]` *(2026-10-08)*
- Loading spinners are replaced with skeletons. `[UI]` *(2026-09-18)*

### 🐛 Bug Fixes / Correcciones
- Fixed seekbar scrub collisions with drawer drag gestures and tuned touch targets for mobile touchscreens. `[UI]` *(2026-10-08)*
- Fix lag when switching themes. `[Themes]` *(2026-09-20)*
- Prevents flash of unstyled/unthemed content on startup. `[UI]` *(2026-09-19)*
- Stops log spam if Discord Rich Presence is unavailable. Reconnects correctly if it becomes available after Nuclear is launched. `[Integrations]` *(2026-09-19)*
- Fixed pressing Enter in the search box searching for a hovered recent search instead of the typed text. `[UI]` *(2026-08-29)*
- Fixed various Appimage issues caused by Wayland. `[Linux]` *(2026-08-16)*
- Fixed playback stopping after double clicking a track in the queue. `[Queue]` *(2026-08-13)*

