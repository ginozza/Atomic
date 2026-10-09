# Atomic - Android Changelog

History of features, improvements, and fixes in Atomic for Android.

## 2026-10-09

- **[FIX]** YouTube stream resolution: Support InnerTube lockupViewModel format, pre-compile bundled YouTube plugin, and add Invidious/Piped fallbacks for search and direct audio streams. `[Streaming]` `[Android]`
- **[IMPROVEMENT]** Background playback & CI/CD: Enhanced Android Foreground Service task persistence and fixed CI and coverage GitHub Actions workflows. `[Android]` `[CI]`

## 2026-10-08

- **[FEATURE]** Atomic Android: Dedicated mobile touch UI with liquid-glass bottom navigation bar, floating mini-player, and swipe-down Now Playing sheet. `[Android]` `[UI]`
- **[FEATURE]** Native Android integration: Hardware back button navigation, Xiaomi HyperOS 3 Super Island dynamic notifications, and MediaSession lockscreen controls. `[Android]` `[Integrations]`
- **[IMPROVEMENT]** Resilient mobile audio engine: YouTube stream fallback with inline iframe, background playback stability, and next-track prefetching. `[Playback]` `[Streaming]`
- **[FIX]** Fixed seekbar scrub collisions with drawer drag gestures and tuned touch targets for mobile touchscreens. `[UI]`
- **[IMPROVEMENT]** Automated Android APK CI/CD pipeline building optimized ARM64 and universal APK releases. `[Android]`

## 2026-09-22

- **[FEATURE]** Stream verification is back. Now with offline verification `[Streaming]` `[Queue]`

## 2026-09-20

- **[FIX]** Fix lag when switching themes. `[Themes]`

## 2026-09-19

- **[FIX]** Prevents flash of unstyled/unthemed content on startup. `[UI]`
- **[FIX]** Stops log spam if Discord Rich Presence is unavailable. Reconnects correctly if it becomes available after Nuclear is launched. `[Integrations]`

## 2026-09-18

- **[IMPROVEMENT]** Loading spinners are replaced with skeletons. `[UI]`

## 2026-09-01

- **[FEATURE]** Theming system v2: themes can now use gradients on surfaces, and a whole new group of variables to make Nuclear more customizable. See the docs and release notes for details. `[UI]` `[Themes]`

## 2026-08-29

- **[FIX]** Fixed pressing Enter in the search box searching for a hovered recent search instead of the typed text. `[UI]`
- **[FEATURE]** Clickable artist/track title in the player bar `[UI]`

## 2026-08-16

- **[FIX]** Fixed various Appimage issues caused by Wayland. `[Linux]`

## 2026-08-13

- **[FIX]** Fixed playback stopping after double clicking a track in the queue. `[Queue]`
- **[FIX]** Fixed duplicate entries appearing in the listening history. `[Playback]`
- **[FIX]** Fixed the previous track briefly playing when starting a new track before its stream is ready. `[Playback]`

## 2026-08-10

- **[IMPROVEMENT]** Nuclear starts maximized by default `[UI]`

## 2026-08-08

- **[FEATURE]** Nuclear Jam remote control now supports searching for music, adding tracks to the queue, and removing tracks from the queue. `[Integrations]`

## 2026-08-05

- **[FEATURE]** Playlists can now be sorted. `[Playlists]`

## 2026-08-03

- **[FEATURE]** Playlists can now be filtered. `[Playlists]`

## 2026-07-30

- **[FEATURE]** History stats tab shows a selection of charts showcasing your listening habits. `[History]`

## 2026-07-20

- **[FIX]** Fix bluetooth issues on Linux. `[Playback]`
- **[FIX]** Tracks that failed to resolve their streams now retry with a fresh search when you come back to them. When no streaming provider is installed, the error message now prompts you to install one. `[Playback]`

## 2026-07-18

- **[FIX]** Fix streaming getting permanently stuck at 10s intervals. `[Playback]`

## 2026-07-16

- **[FEATURE]** Listening history: Nuclear now keeps a history of the tracks you play. Can be disabled in the preferences. `[History]`

## 2026-07-08

- **[FIX]** Fix playback stalling at 10-second fMP4 segment boundaries (0:09, 0:19, 0:29...) when streaming via yt-dlp, caused by sub-frame gaps between appended segments `[Playback]`

## 2026-07-07

- **[FIX]** Theme loading performance improvements `[Themes]`
- **[IMPROVEMENT]** Recent searches appear under the search box, with keyboard navigation and one-click history clearing `[UI]`

## 2026-07-06

- **[IMPROVEMENT]** Search box with clear button, search icon, Escape to clear, and URL sync `[UI]`

## 2026-07-01

- **[FIX]** Fix audio going silent after about a second over Bluetooth on Linux `[Playback]`
- **[FIX]** Fix yt-dlp playback stalling at segment boundaries (e.g. 0:09, 0:29) when buffered audio drifted past the next segment's start time `[Playback]`
- **[FIX]** Fix marketplace themes resetting to default on restart `[Themes]`

## 2026-06-21

- **[FEATURE]** Custom title bar for frameless window mode. Enable in Settings -> Appearance `[UI]`

## 2026-06-19

- **[FIX]** Fix HLS playback failing on Windows with Chromium 147+ `[Playback]`
- **[FIX]** We're temporarily switching to nightly yt-dlp due to a regression. This will fix playlist imports. `[Playlists]`

## 2026-06-17

- **[FEATURE]** Navigate to playlists directly from artist pages that have them `[Artists]`

## 2026-06-14

- **[FIX]** Fix the queue getting stuck at the end of some tracks, where playback parked a fraction of a second before the end and never advanced to the next track `[Playback]`

## 2026-06-10

- **[FEATURE]** Right-click a queue item to see its stream candidates and switch to a different source; picking a failed source retries it `[Queue]`

## 2026-06-09

- **[FIX]** Fix TSX plugins failing with 'React is not defined' unless they imported React manually, and fix stale plugin code being served when an imported file changed but the entry file didn't `[Plugins]`

## 2026-06-01

- **[FEATURE]** The window now remembers its size, position, and maximized state between restarts `[UI]`

## 2026-05-27

- **[FEATURE]** Nuclear Jam lets you control playback from any device on your local network. Enable it in Settings -> Integrations, then scan the QR code with your phone. `[Integrations]`

## 2026-05-22

- **[FIX]** Fix HLS tracks getting stuck at 0:00 when the queue advances `[Streaming]`

## 2026-05-21

- **[FIX]** Fix tracks failing to play in saved playlists and in queues restored after restart by re-resolving stream URLs when they expire `[Streaming]`

## 2026-05-11

- **[FEATURE]** MPD server lets you control Nuclear from MPD clients like mpc and ncmpcpp `[Integrations]`

## 2026-05-04

- **[FEATURE]** Installed plugins are automatically updated to the latest version on startup `[Plugins]`

## 2026-04-22

- **[FIX]** Fix legacy playlist import failing when track durations use mm:ss or hh:mm:ss format `[Playlists]`

## 2026-04-17

- **[FIX]** Fix source selection being reset to the first available provider on startup `[Plugins]`
- **[FIX]** Show an empty state in Sources when no providers of a given kind are installed `[UI]`

## 2026-04-08

- **[FEATURE]** Streaming providers can now access full track metadata when resolving streams `[Plugins]`
- **[FIX]** Fix paired streaming provider not activating when registered after the metadata provider `[Plugins]`

## 2026-04-02

- **[FEATURE]** Frameless window toggle in settings `[UI]`

## 2026-04-01

- **[FEATURE]** Back and forward navigation buttons in the top bar `[UI]`
- **[FEATURE]** Theme store for browsing and installing community themes `[Themes]`

## 2026-03-27

- **[FEATURE]** Discord rich presence integration `[Integrations]`

## 2026-03-26

- **[FEATURE]** Plugins can provide music discovery recommendations based on the current queue `[Plugins]` `[Playback]`

## 2026-03-24

- **[IMPROVEMENT]** Introduce dark mode as persistent preference `[Settings]`
- **[FIX]** Fix issues with tables being way too wide with longer track titles `[UI]`

## 2026-03-21

- **[IMPROVEMENT]** Nuclear is now built from source for Flatpak, with new app icons `[Linux]`

## 2026-03-20

- **[FIX]** Fixed album tracks being added to the queue without thumbnails `[Queue]`
- **[IMPROVEMENT]** Dashboard, search, and plugins views now prompt to install plugins when none are active `[Plugins]`

## 2026-03-18

- **[IMPROVEMENT]** AUR packages are now automatically updated when a new release is published `[Linux]`

## 2026-03-16

- **[FIX]** Fixed a console window briefly appearing on Windows each time yt-dlp was invoked `[Windows]`
- **[FIX]** Queue items are now correctly restored when restarting Nuclear. `[Playback]`
- **[FEATURE]** New Sources view lets you switch the active metadata and streaming providers from the sidebar `[Sources]`

## 2026-03-14

- **[IMPROVEMENT]** yt-dlp is now downloaded and updated automatically at runtime, fixing Flatpak and AppImage compatibility `[Playback]`

## 2026-03-13

- **[FEATURE]** Border width is now themable - advanced themes can set border-width to control all borders in the app `[Themes]`
- **[IMPROVEMENT]** Improved dark mode for all basic themes with better backgrounds, toned-down primaries, and themed borders `[Themes]`

## 2026-03-12

- **[FEATURE]** Update badge shows download progress and lets you click to update or restart `[Updates]`

## 2026-03-09

- **[FEATURE]** Social links in settings sidebar (Discord, GitHub, Mastodon, Website) `[Settings]`

## 2026-03-08

- **[FIX]** Fixed repeat, shuffle, and volume for MSE streams `[Playback]`

## 2026-03-07

- **[FEATURE]** Plugins can import YouTube playlists by URL via yt-dlp `[Playlists]` `[Plugins]` `[YouTube]`

## 2026-03-06

- **[FIX]** YouTube tracks now play using MSE-based streaming, fixing incorrect duration display and enabling proper seeking `[Playback]` `[Streaming]`

## 2026-03-05

- **[FEATURE]** Customizable keyboard shortcuts with settings UI for rebinding `[Settings]` `[Playback]`

## 2026-03-04

- **[FEATURE]** Plugin event bus with trackFinished and trackStarted events `[Plugins]`
- **[FEATURE]** Custom settings widgets for plugins (render React components in settings UI) `[Plugins]`
- **[FEATURE]** Shell API for plugins to open URLs in the system browser `[Plugins]`
- **[FEATURE]** Plugins can use Nuclear UI components (Button, Toggle, etc.) `[Plugins]`
- **[FIX]** Fixed plugin settings using wrong storage key (core prefix instead of plugin prefix) `[Settings]`

## 2026-03-03

- **[FIX]** Fixed old audio stream continuing to play when switching tracks or clearing the queue `[Playback]`

## 2026-03-01

- **[FEATURE]** In-app changelog in settings (What's New tab) `[Settings]`
- **[IMPROVEMENT]** Release pipeline auto-generates GitHub release notes from changelog data 
- **[FEATURE]** Support importing legacy format playlists (from old Nuclear) `[Playlists]`

## 2026-02-28

- **[CHORE]** Migrated repository to nukeop/nuclear 

## 2026-02-25

- **[FEATURE]** Playlist import from URL `[Playlists]`
- **[FEATURE]** Playlist provider adapter view with cover art `[Playlists]` `[Plugins]`
- **[FIX]** Fixed loading status getting stuck on stream resolution 

## 2026-02-20

- **[FEATURE]** MCP server for controlling Nuclear from AI agents and other tools `[MCP]`
- **[FEATURE]** Plugin store with browsing, search, and installation `[Plugins]`
- **[FEATURE]** Flatpak packaging `[Linux]`

