import { invoke } from '@tauri-apps/api/core';

import type {
  HttpHost,
  HttpRequestInit,
  HttpResponseData,
} from '@nuclearplayer/plugin-sdk';

import { Logger } from './logger';

export const httpHost: HttpHost = {
  fetch: async (
    url: string,
    init?: HttpRequestInit,
  ): Promise<HttpResponseData> => {
    const method = init?.method ?? 'GET';
    Logger.http.debug(`${method} ${url}`);

    try {
      const response = await window.fetch(url, {
        method,
        headers: init?.headers,
        body: init?.body,
        signal: AbortSignal.timeout(10_000),
      });

      const body = await response.text();
      const headers: Record<string, string> = {};
      response.headers.forEach((val, key) => {
        headers[key] = val;
      });

      Logger.http.debug(
        `${method} ${url} -> ${response.status} (via webview fetch)`,
      );
      return {
        status: response.status,
        headers,
        body,
      };
    } catch {
      // Fall through to Tauri http_fetch proxy if CORS or other webview fetch issue
    }

    const response = await invoke<HttpResponseData>('http_fetch', {
      request: {
        url,
        method,
        headers: init?.headers,
        body: init?.body,
      },
    });

    Logger.http.debug(`${method} ${url} -> ${response.status}`);

    return response;
  },
};
