#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Find the preload-helper file in dist/assets
const distAssetsPath = join(process.cwd(), 'dist', 'assets');
let files = [];
try {
  files = readdirSync(distAssetsPath).filter(f => f.startsWith('preload-helper-') && f.endsWith('.js'));
} catch {
  console.log('⚠️  dist/assets not found, skipping patch');
  process.exit(0);
}

if (files.length === 0) {
  console.log('⚠️  No preload-helper found, skipping patch');
  process.exit(0);
}

files.forEach((filename) => {
  const file = join(distAssetsPath, filename);
  let code = readFileSync(file, 'utf8');
  
  // Patch the error re-throw to suppress DOMException/AbortError
  // Original: if(...,window.dispatchEvent(t),!t.defaultPrevented)throw e
  // Patched: suppress DOMException before throwing
  const patched = code.replace(
    /if\(([^,]+),window\.dispatchEvent\(([^)]+)\),!([^.]+)\.defaultPrevented\)throw\s+(\w+)/g,
    (match, condition, event, prevented, errorVar) => {
      return `if(${condition},window.dispatchEvent(${event}),!${prevented}.defaultPrevented&&!(${errorVar} instanceof DOMException)&&!(${errorVar}?.name==="AbortError"))throw ${errorVar}`;
    }
  );

  if (patched !== code) {
    writeFileSync(file, patched, 'utf8');
    console.log(`✅ Patched ${file} to suppress DOMException in preload-helper`);
  } else {
    console.log(`⚠️  Could not patch ${file} — pattern not found`);
  }
});

