import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '../../..');
const changelogPath = resolve(rootDir, 'packages/player/changelog.json');
const pkgPath = resolve(rootDir, 'packages/player/package.json');

const changelog = JSON.parse(readFileSync(changelogPath, 'utf-8'));
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

const recentEntries = changelog.slice(0, 15);

const typeHeaders = {
  feature: 'New Features / Nuevas Características',
  improvement: 'Improvements / Mejoras',
  fix: 'Bug Fixes / Correcciones',
  plugin: 'Plugins',
  chore: 'Maintenance / Mantenimiento',
  docs: 'Documentation / Documentación',
};

const grouped = {};
for (const entry of recentEntries) {
  const type = entry.type || 'improvement';
  if (!grouped[type]) {
    grouped[type] = [];
  }
  grouped[type].push(entry);
}

let releaseNotes = `# 🎵 Atomic v${pkg.version} (Android)\n\n`;
releaseNotes += `Free, open-source, and privacy-first music player for Android without ads or tracking.\n\n`;
releaseNotes += `## Highlights & What's New\n\n`;

for (const [type, header] of Object.entries(typeHeaders)) {
  if (grouped[type] && grouped[type].length > 0) {
    releaseNotes += `### ${header}\n`;
    for (const item of grouped[type]) {
      const tags = (item.tags || [])
        .map((tag) => `\`[${tag.label}]\``)
        .join(' ');
      const date = item.date ? item.date.split('T')[0] : '';
      releaseNotes += `- ${item.description} ${tags} ${date ? `*(${date})*` : ''}\n`;
    }
    releaseNotes += `\n`;
  }
}

let fullChangelog = `# 🎵 Atomic - Android Changelog\n\n`;
fullChangelog += `History of features, improvements, and fixes in Atomic for Android.\n\n`;

const entriesByDate = {};
for (const entry of changelog) {
  const dateKey = entry.date ? entry.date.split('T')[0] : 'Earlier';
  if (!entriesByDate[dateKey]) {
    entriesByDate[dateKey] = [];
  }
  entriesByDate[dateKey].push(entry);
}

for (const [date, items] of Object.entries(entriesByDate)) {
  fullChangelog += `## ${date}\n\n`;
  for (const item of items) {
    const badge = item.type ? `**[${item.type.toUpperCase()}]**` : '';
    const tags = (item.tags || []).map((tag) => `\`[${tag.label}]\``).join(' ');
    fullChangelog += `- ${badge} ${item.description} ${tags}\n`;
  }
  fullChangelog += `\n`;
}

writeFileSync(resolve(rootDir, 'CHANGELOG.md'), fullChangelog, 'utf-8');
writeFileSync(resolve(rootDir, 'RELEASE_NOTES.md'), releaseNotes, 'utf-8');
console.log('✅ Generated CHANGELOG.md and RELEASE_NOTES.md successfully!');
