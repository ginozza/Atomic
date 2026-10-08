import ReactDOM from 'react-dom/client';

import '@nuclearplayer/tailwind-config';
import '@nuclearplayer/themes';
import '@nuclearplayer/i18n';

// Vite's preload-helper dispatches a cancelable 'vite:preloadError' event
// before re-throwing any error that occurs during dynamic import preloading.
// This fires when a dynamic import fetch is cancelled mid-flight (e.g. audio
// stream aborted on skip). Cancelling prevents the re-throw that crashes the
// Chromium renderer on Android.
window.addEventListener('vite:preloadError', (event) => {
  // Always cancel — any preload error during normal app use is recoverable.
  // The component that triggered the import will simply not mount/update.
  event.preventDefault();
});

// Belt-and-suspenders: also suppress at the promise rejection level.
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  if (
    reason instanceof DOMException ||
    (reason instanceof Error && reason.name === 'AbortError')
  ) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true);

// Final safety net: suppress DOMException at the synchronous error level.
// React 18 can re-dispatch caught errors synchronously via window.onerror.
{
  const prev = window.onerror;
  window.onerror = (msg, src, line, col, error) => {
    const errorText =
      typeof msg === 'string'
        ? msg
        : error instanceof Error
          ? error.message
          : '';
    if (
      error instanceof DOMException ||
      (error instanceof Error && error.name === 'AbortError') ||
      errorText.includes('removeChild') ||
      errorText.includes('not a child of this node')
    ) {
      return true;
    }
    return prev ? prev.call(window, msg, src, line, col, error) : false;
  };
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
const isTauri = !!(window as Window & { __TAURI_INTERNALS__?: unknown })
  .__TAURI_INTERNALS__;

// Dynamic imports avoid loading Tauri modules in the browser
if (isTauri) {
  const { initPlayerApp } = await import('./initPlayerApp');
  await initPlayerApp(root);
} else {
  const { initRemoteApp } = await import('./remoteControl');
  initRemoteApp(root);
}
