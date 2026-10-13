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

    const isTauri =
      typeof window !== 'undefined' &&
      Boolean(
        (window as Window & { __TAURI_INTERNALS__?: unknown })
          .__TAURI_INTERNALS__,
      );

    if (isTauri) {
      try {
        const response = await invoke<HttpResponseData>('http_fetch', {
          request: {
            url,
            method,
            headers: init?.headers,
            body: init?.body,
          },
        });
        Logger.http.debug(
          `${method} ${url} -> ${response.status} (via tauri http_fetch)`,
        );
        return response;
      } catch (invokeError) {
        Logger.http.debug(
          `tauri http_fetch failed for ${url}, falling back to webview: ${invokeError}`,
        );
      }
    }

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

export const initFetchProxyFallback = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  const originalFetch = window.fetch;
  window.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    try {
      return await originalFetch(input, init);
    } catch (fetchError) {
      const urlString =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (urlString.startsWith('http://') || urlString.startsWith('https://')) {
        const method =
          init?.method ??
          (typeof input === 'object' && 'method' in input
            ? input.method
            : 'GET');

        const headers: Record<string, string> = {};
        if (init?.headers) {
          if (init.headers instanceof Headers) {
            init.headers.forEach((value, key) => {
              headers[key] = value;
            });
          } else if (Array.isArray(init.headers)) {
            init.headers.forEach(([key, value]) => {
              headers[key] = value;
            });
          } else {
            Object.assign(headers, init.headers);
          }
        } else if (
          typeof input === 'object' &&
          'headers' in input &&
          input.headers
        ) {
          input.headers.forEach((value, key) => {
            headers[key] = value;
          });
        }

        let body: string | undefined;
        if (typeof init?.body === 'string') {
          body = init.body;
        }

        try {
          const response = await invoke<HttpResponseData>('http_fetch', {
            request: {
              url: urlString,
              method,
              headers,
              body,
            },
          });

          return new Response(response.body, {
            status: response.status,
            headers: response.headers,
          });
        } catch {
          // fall through
        }
      }

      throw fetchError;
    }
  };
};
