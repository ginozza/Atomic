<p align="center">
  <picture>
    <source alt="Atomic Music Player"  srcset="packages/docs/.gitbook/assets/readme-banner.png">
    <img alt="Atomic Music Player"  srcset="packages/docs/.gitbook/assets/readme-banner.png">
  </picture>


</p>

<div align="center">

# Atomic

**Mobile-First Music Player Fork for Android**

</div>

<div align="center">

  Atomic is a free, open-source mobile-first music player fork of Nuclear Music Player without ads or tracking. Search for any song or artist, build playlists, and start listening.<br>
  Featuring a liquid-glass aesthetic, touch-first mobile controls, and cross-platform desktop support (Windows, macOS, and Linux).
  
</div>

## Download

Grab the latest release for your platform from the [Releases page](https://github.com/ginozza/Atomic/releases).

| Platform | Formats |
|----------|---------|
| Android | `.apk` (Universal APK) |
| Windows | `.exe` installer, `.msi` |
| macOS | `.dmg` (Apple Silicon and Intel) |
| Linux | `.AppImage`, `.deb`, `.rpm`, `.flatpak` |

### Android APK

For local Android testing, build the universal debug APK from the repository:

```bash
pnpm --filter @nuclearplayer/player tauri android build --debug --apk true
```

The generated file is `packages/player/src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk`.

## Features

- **Xiaomi HyperOS 3 Super Island**: Real-time notification island, media session controls, and touch status updates
- **Liquid-Glass Aesthetic**: Frosted backdrop blurs (`backdrop-blur-md`), translucent card surfaces, glowing accents, and fluid transitions
- **Touch-First Mobile Controls**: Dedicated, non-overlapping touch controls for play/pause, skip, shuffle, repeat, and volume
- **Full Plugin Ecosystem**: 100% compatible with existing Nuclear plugins and `@nuclearplayer/plugin-sdk`
- Search for music and stream it from any source
- Browse artist pages with biographies, discographies, and similar artists
- Browse album pages with track listings
- Queue management with shuffle, repeat, and drag-and-drop reordering
- Favorites (albums, artists, and tracks)
- Playlists (create, import, export, import from various services)
- Atomic Jam local network remote control
- Built-in MCP server letting your AI agent drive the player
- Built-in local MPD server
- Auto-updates, keyboard shortcuts, and localization in multiple languages

## Plugins

Atomic has full compatibility with the Nuclear plugin ecosystem! Plugins can provide streaming sources, metadata, playlists, dashboard content, and more. Browse and install plugins from the built-in plugin store, or write your own using the [@nuclearplayer/plugin-sdk](https://www.npmjs.com/package/@nuclearplayer/plugin-sdk).

## MCP

You can enable the MCP server in Settings → Integrations.

Then to add it to **Claude Code:**

```bash
claude mcp add nuclear --transport http http://127.0.0.1:8800/mcp
```

**Codex CLI:**

```bash
codex mcp add nuclear --url http://127.0.0.1:8800/mcp
```

**OpenCode:**

```json
{
  "mcp": {
    "nuclear": {
      "type": "remote",
      "url": "http://127.0.0.1:8800/mcp"
    }
  }
}
```

**Claude Desktop / Cursor / Windsurf:**

```json
{
  "mcpServers": {
    "nuclear": {
      "url": "http://127.0.0.1:8800/mcp"
    }
  }
}
```

The MCP is designed to be discoverable, but there's a skill you can load to get your AI up to speed: [Nuclear MCP Skill](./packages/docs/.gitbook/assets/nuclear-mcp.zip)

## Development

Nuclear is a pnpm monorepo managed with Turborepo. The main app is built with Tauri (Rust + React).

### Prerequisites

- Node.js >= 22
- pnpm >= 9
- Rust (stable)
- Platform-specific Tauri dependencies ([see Tauri docs](https://v2.tauri.app/start/prerequisites/))

### Getting started

```bash
git clone https://github.com/ginozza/Atomic.git
cd Atomic
pnpm install
pnpm dev
```

### Useful commands

```bash
pnpm dev            # Run the player in dev mode
pnpm dev:remote     # Same, but binds Vite to 0.0.0.0 so you can open the remote control UI from other devices on your LAN
pnpm build          # Build all packages
pnpm test           # Run all tests
pnpm lint           # Lint all packages
pnpm type-check     # TypeScript checks
pnpm storybook      # Run Storybook
```

## Community

- [Discord](https://discord.gg/JqPjKxE)
- [Mastodon](https://fosstodon.org/@nuclearplayer)
- [Discussions](https://github.com/nukeop/nuclear/discussions)

## License

AGPL-3.0. See [LICENSE](LICENSE).
