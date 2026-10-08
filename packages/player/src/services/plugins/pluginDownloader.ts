import { appDataDir, join } from '@tauri-apps/api/path';
import { BaseDirectory, remove, writeFile } from '@tauri-apps/plugin-fs';

import { Logger } from '../logger';
import { ensureDir } from '../../utils/path';
import { downloadFile, extractZip } from '../tauri/commands';

const DOWNLOADS_DIR = 'plugins/.downloads';

type DownloadPluginOptions = {
  pluginId: string;
  downloadUrl: string;
};

const getDownloadsDir = async (): Promise<string> => {
  await ensureDir(DOWNLOADS_DIR);
  const base = await appDataDir();
  return join(base, DOWNLOADS_DIR);
};

export const downloadAndExtractPlugin = async ({
  pluginId,
  downloadUrl,
}: DownloadPluginOptions): Promise<string> => {
  Logger.plugins.info(`Downloading plugin ${pluginId} from ${downloadUrl}`);
  const downloadsDir = await getDownloadsDir();
  const zipPath = await join(downloadsDir, `${pluginId}.zip`);
  const extractPath = await join(downloadsDir, pluginId);
  const relativeZipPath = await join(DOWNLOADS_DIR, `${pluginId}.zip`);

  let downloaded = false;
  try {
    const res = await fetch(downloadUrl);
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      await writeFile(relativeZipPath, bytes, { baseDir: BaseDirectory.AppData });
      downloaded = true;
      Logger.plugins.info(
        `Plugin ${pluginId} downloaded via fetch (${bytes.length} bytes)`,
      );
    }
  } catch {
    // Fetch failed or blocked by CORS, proceed to native download
  }

  if (!downloaded) {
    await downloadFile(downloadUrl, zipPath);
  }

  Logger.plugins.info(`Extracting plugin ${pluginId} to ${extractPath}`);
  await extractZip(zipPath, extractPath);
  try {
    await remove(relativeZipPath, { baseDir: BaseDirectory.AppData });
  } catch {
    // Ignore cleanup error of zip file
  }

  Logger.plugins.info(`Plugin ${pluginId} downloaded and extracted successfully`);
  return extractPath;
};

export const cleanupDownload = async (pluginId: string): Promise<void> => {
  const downloadsDir = await getDownloadsDir();
  const extractPath = await join(downloadsDir, pluginId);

  try {
    await remove(extractPath, { recursive: true });
  } catch {
    // Ignore cleanup errors - directory may not exist
  }
};
