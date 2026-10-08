# E2E Test Infrastructure: Atomic Music Player (Phase 2 Resiliency & Platform Hardening)

## Test Philosophy
- **Requirement-Driven & Opaque-Box**: Directly derived from `ORIGINAL_REQUEST.md` (2026-10-08T20:50:54Z) and `orchestrator_2/PROJECT.md`.
- **4-Tier Verification Methodology**:
  - **Tier 1: Feature Coverage** — Primary execution paths for stream resolution, fallbacks, shimmer loading visual feedback, bundled plugin installation, and default provider selection.
  - **Tier 2: Boundary & Corner Cases** — Extreme limits including 8s candidate timeouts, 20s global timeouts, all-candidates failing, network abort cancellations, empty queues, and duplicate plugin install attempts.
  - **Tier 3: Cross-Feature Combinations** — Interactions between systems: stream retry after errors, shimmer transition through loading -> playing -> paused states, and direct audio stream URL routing via proxy with Android background bridge actions.
  - **Tier 4: Real-World Application Scenarios** — Complete user journeys: clean install boot with auto-installed essential plugins, track search and resolution with automatic candidate fallback to active playback, resilient retry recovery, and Android background playback controls.

---

## Feature Inventory (Phase 2: R1, R2, R3, R4)
| # | Feature | Scope | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---------|-------|:------:|:------:|:------:|:------:|
| 21 | Candidate & Global Timeouts | R1 / M6 | ✓ | ✓ | | ✓ |
| 22 | Candidate Fallback & Error Capture | R1 / M6 | ✓ | ✓ | ✓ | ✓ |
| 23 | Queue Unblocking & Retry Flow | R1 / M6 | | ✓ | ✓ | ✓ |
| 24 | Resolution Toast Notifications | R1 / M6 | | ✓ | | ✓ |
| 25 | Toxic Shimmer Keyframes & Tokens | R2 / M7 | ✓ | | ✓ | |
| 26 | Playback Controls Loading State | R2 / M7 | ✓ | | ✓ | ✓ |
| 27 | WebView Lifecycle Audio Suspension Fix | R3 / M8 | ✓ | | | ✓ |
| 28 | Direct Audio Stream Resolution on Android | R3 / M8 | ✓ | | ✓ | ✓ |
| 29 | MediaSession & WakeLock Hardening | R3 / M8 | ✓ | | ✓ | ✓ |
| 30 | Bundled Plugins Fallback Expansion | R4 / M9 | ✓ | | | ✓ |
| 31 | First-Run Offline Auto-Installation | R4 / M9 | ✓ | ✓ | | ✓ |
| 32 | Default Provider Configuration | R4 / M9 | ✓ | | | ✓ |

---

## Test Architecture & Harness

### Runners & Frameworks
- **Test Runner**: Vitest v5 with `jsdom` environment.
- **UI & DOM Assertions**: `@testing-library/react` and `@testing-library/user-event`.
- **State Stores**: Zustand stores (`useQueueStore`, `useSoundStore`, `useProvidersStore`, `usePluginStore`, `useStartupStore`, `useSettingsStore`).
- **Service Interfaces**:
  - `streamResolution` (`StreamResolution`)
  - `streamingHost` (`StreamingHost`)
  - `providersHost` (`ProvidersHost`)
  - `AudioSourceFactory`
  - `hydratePluginsFromRegistry` / `pluginBootstrap`
  - `useHyperIslandBridge` (Native Android bridge)

### Test Location
- Exclusive E2E Test Suite: `packages/player/src/test/e2e/atomic-resilience.e2e.test.tsx`
- Run Command:
  ```bash
  pnpm --filter @nuclearplayer/player test -- src/test/e2e/atomic-resilience.e2e.test.tsx
  ```

---

## Detailed 4-Tier Test Matrix

### Tier 1: Feature Coverage
1. **R1: Primary Stream Resolution**:
   - Given a queued track and an active streaming provider, `streamResolution.resolve` resolves candidate streams, sets audio source on `soundStore`, and updates item status to `'success'`.
2. **R1: Automatic Candidate Fallback**:
   - When the first stream candidate rejects or fails, `tryCandidatesInOrder` automatically falls back to Candidate 2, resolves its stream URL, and starts playback.
3. **R2: Playback Controls Loading Indicator**:
   - When `currentItem.status === 'loading'`, `PlayerBarControls` and ConnectedControls render the loading indicator / shimmer pulse state.
4. **R2: Mobile Floating Mini Player Loading State**:
   - In `ConnectedFloatingMiniPlayer`, when `currentItem.status === 'loading'`, the play/pause button renders with shimmer / loading classes.
5. **R2: Now Playing Modal Loading State**:
   - In `ConnectedNowPlayingModal`, when `currentItem.status === 'loading'`, the full-screen play button displays loading shimmer styling.
6. **R3: Direct Audio Stream URL Routing**:
   - When stream extraction resolves a direct audio stream (`container: 'm4a'` or `mimeType: 'audio/mp4'`), `AudioSourceFactory` encodes the stream URL and proxies through the local streaming server (`http://127.0.0.1:9100/stream/...`) with `protocol: 'mse'` or `'https'`, ensuring HTML5 `<audio>` playback instead of YouTube iframe.
7. **R3: Android Background Service Bridge**:
   - `useHyperIslandBridge` listens to `nuclear:hyperisland:action` and routes actions (`toggle`, `next`, `previous`, `stop`) to playback stores.
8. **R4: Bundled Plugins Fallback Packaging**:
   - `FALLBACK_PLUGINS` in `bundledPlugins.ts` contains valid manifests and bundles for all 4 essential plugins: Spotify (`nuclear-plugin-something`), YouTube (`nuclear-plugin-youtube`), Last.fm (`nuclear-plugin-lastfm`), and Deezer Dashboard (`nuclear-plugin-deezer-dashboard`).
9. **R4: Default Provider Resolution on Bootstrap**:
   - When metadata, streaming, dashboard, and discovery providers are registered on clean boot, `providersHost.resolveActiveOnBootstrap()` sets preferred defaults: metadata -> `'spotify'`, streaming -> `'youtube'`, dashboard -> `'deezer-dashboard'`, discovery -> `'lastfm-discovery'`.

### Tier 2: Boundary & Corner Cases
1. **Per-Candidate Timeout Boundary**:
   - When candidate resolution exceeds timeout limit (8s), it times out, marks candidate failed, and cascades to the remaining candidates.
2. **Global Resolution Timeout Boundary**:
   - When candidate search hangs or total resolution exceeds 20s, resolution aborts cleanly, transitions item to `'error'`, and frees the queue.
3. **All Candidates Failing**:
   - When all candidates throw or return failed, item transitions to `{ status: 'error', error: 'streaming:errors.allCandidatesFailed' }`, `toast.error` is triggered, and the queue remains unblocked.
4. **Network Aborts & Concurrent Resolution Superseding**:
   - When switching tracks while resolution is in progress (`status: 'loading'`), the prior resolution AbortController is aborted, and the new track takes precedence without race conditions.
5. **Empty Queue / No Candidates Found**:
   - When a track has no candidates returned from provider search, status transitions to `'error'` with `noCandidatesFound` without freezing the UI.
6. **Duplicate Plugin Install Handling**:
   - Attempting to install or enable a plugin that already exists in the registry completes idempotently without duplication or unhandled crashes.

### Tier 3: Cross-Feature Combinations
1. **Stream Retry After Error**:
   - When a track is in `'error'` status, retrying via `resolveWithFreshStreams` or clicking play resets item status, strips failure flags, and re-resolves successfully.
2. **Shimmer Transition Across Lifecycle**:
   - Initial resolving state displays shimmer pulse -> transitions to playing state displaying standard pause button without shimmer -> transitions to paused state displaying play button without shimmer.
3. **Direct Audio Stream Routing with Android Bridge Actions**:
   - Direct audio stream is resolved via proxy -> bridge dispatches playback metadata to `NuclearAndroid.updatePlayback` -> lockscreen action `'toggle'` pauses playback, and `'next'` advances the queue.
4. **Error Recovery & Queue Skipping**:
   - Track 1 encounters a stream failure -> user or queue advances to Track 2 -> Track 2 succeeds -> user navigates back to Track 1 -> previous error state is cleared and retried cleanly.

### Tier 4: Real-World Application Scenarios
1. **Scenario 1: Clean Install Boot & Auto-Bootstrap Workflow**:
   - Fresh install boot with empty registry -> auto-installs and enables all 4 essential bundled plugins -> resolves preferred default providers (`spotify` for metadata, `youtube` for streaming) -> app is instantly playback-ready.
2. **Scenario 2: Track Search to Stream Resolution with Fallback**:
   - User searches track -> selects track to play -> Candidate 1 fails -> automatic fallback to Candidate 2 succeeds -> direct audio stream URL is proxied -> sound starts playing.
3. **Scenario 3: Resilient Playback Recovery After Network Failure**:
   - Queued track experiences network resolution timeout / failure -> error toast is displayed -> user retries track -> fresh resolution succeeds and starts playback.
4. **Scenario 4: Android HyperOS Super Island & Continuous Background Playback Lifecycle**:
   - Track plays direct stream -> `NuclearAndroid.updatePlayback` receives state -> device enters background -> lockscreen action `'toggle'` pauses and resumes playback seamlessly.
