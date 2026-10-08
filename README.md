<div align="center">

# Atomic

**Free, Open-Source Music Player for Android**

Atomic is a free, open-source music player for Android without ads or tracking. Search for any song or artist, build playlists, and start listening on your mobile device.<br>
Featuring a liquid-glass aesthetic, touch-first mobile controls, dynamic island notifications, and complete privacy by design.

</div>

---

## Download

Grab the latest Android APK release from the [Releases page](https://github.com/ginozza/Atomic/releases).

| Platform | Format | Architecture |
|----------|--------|--------------|
| Android | `.apk` | ARM64 (`aarch64-linux-android`) & Universal |

### Building Android APK locally

To build the APK from source:

```bash
pnpm --filter @nuclearplayer/player tauri android build --apk
```

The APK will be generated at `packages/player/src-tauri/gen/android/app/build/outputs/apk/`.

---

## Key Features

- **Xiaomi HyperOS 3 Super Island & Dynamic Islands**: Real-time notification island, media session controls, and touch status updates.
- **Liquid-Glass Aesthetic**: Frosted backdrop blurs (`backdrop-blur-md`), translucent card surfaces, glowing accents, and fluid transitions.
- **Touch-First Mobile Controls**: Dedicated, non-overlapping touch controls for play/pause, seek scrub, skip, shuffle, repeat, and volume.
- **Floating Mini-Player & Now Playing Sheet**: Seamless playback control while browsing with expandable bottom sheets.
- **Hardware Back Button Handling**: Native Android back navigation across modals, drawers, and playback views.
- **Full Plugin Ecosystem**: 100% compatible with existing Nuclear plugins and `@nuclearplayer/plugin-sdk`.
- **Decentralized Music Search & Streaming**: Stream music from multiple providers without accounts or tracking.
- **Artist & Album Discographies**: Biographies, full track listings, and related artist discovery.
- **Queue & Playlist Management**: Drag-and-drop reordering, favorites, local caching, and playlist import/export.
- **Atomic Jam**: Local network remote control.
- **Built-in MCP Server**: Expose player functions to AI assistants via Model Context Protocol.
- **Privacy First**: No ads, no tracking, no account required, completely open source.

---

## Plugins

Atomic is fully compatible with the Nuclear plugin ecosystem. Plugins can provide streaming sources, metadata, playlists, dashboard content, and more. Browse and install plugins directly within the app, or create your own with [@nuclearplayer/plugin-sdk](https://www.npmjs.com/package/@nuclearplayer/plugin-sdk).

---

## MCP (Model Context Protocol)

You can enable the MCP server in Settings → Integrations.

Then connect your AI tool:

**Claude Code:**

```bash
claude mcp add atomic --transport http http://127.0.0.1:8800/mcp
```

**Codex CLI:**

```bash
codex mcp add atomic --url http://127.0.0.1:8800/mcp
```

**OpenCode / Claude Desktop / Cursor:**

```json
{
  "mcpServers": {
    "atomic": {
      "url": "http://127.0.0.1:8800/mcp"
    }
  }
}
```

---

## Development

Atomic is built with Tauri v2 (Rust + React) inside a pnpm monorepo managed with Turborepo.

### Prerequisites

- Node.js >= 22
- pnpm >= 9
- Rust (stable) with `aarch64-linux-android` target
- Android SDK & NDK

### Getting Started

```bash
git clone https://github.com/ginozza/Atomic.git
cd Atomic
pnpm install
pnpm dev
```

### Useful Commands

```bash
pnpm dev            # Run player in dev mode
pnpm build          # Build packages
pnpm test           # Run tests
pnpm lint           # Lint packages
pnpm type-check     # TypeScript check
```

---

## License

AGPL-3.0. See [LICENSE](LICENSE).
