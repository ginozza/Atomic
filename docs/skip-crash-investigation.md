# Investigación: Crash al hacer Skip/Prev durante reproducción

**Fecha:** 2026-10-07  
**Plataforma:** Android (Tauri + WebView)  
**Síntoma:** Al presionar "siguiente" o "anterior" mientras una canción se está reproduciendo, la app crashea y muestra "Something went wrong".

---

## 1. Contexto real del flujo

### Dos controles hacen skip en Android, con comportamientos distintos

**Mini player** (`ConnectedFloatingMiniPlayer`):
- Next → `goToNext()` directo del store (sin pasar por `playbackManager`)
- No tiene botón de Previous

**Now Playing Modal** (`ConnectedNowPlayingModal`):
- Next → `goToNext()` directo del store
- Previous → `goToPrevious()` directo del store (sin pasar por `playbackManager`)

**Player Bar de escritorio** (`ConnectedControls`):
- Next → `goToNext()` directo del store
- Previous → `playbackManager.previous()` (que verifica posición antes de ir atrás)

**El `playbackManager.previous()` hace esto:**
```ts
previous = (): void => {
  const { seek, status } = useSoundStore.getState();
  if (status === 'playing' && seek > PREVIOUS_RESTART_THRESHOLD_SECONDS) {
    useSoundStore.getState().seekTo(0);
    return;
  }
  useQueueStore.getState().goToPrevious();
};
```

Es decir: el modal de Android **bypasea** el threshold de 3 segundos y llama `goToPrevious()` directamente. Esto no es el crash, pero es una inconsistencia.

### Qué hace `goToNext()` y `goToPrevious()`

Ambos siguen este patrón:
```ts
goToNext: withPersistence(() => {
  // ...lógica de shuffle/lineal...
  emitSkip();
  useSoundStore.getState().stop();
  useSoundStore.getState().setSrc(null);
  set({ currentIndex: nextIndex });
})
```

El `withPersistence` envuelve la función y llama `saveToDisk()` al final. `saveToDisk()` encola una Promise en `persistenceQueue`.

Después de que `set({ currentIndex })` dispara, `useStreamResolution` reacciona porque está suscrito al store y llama:
```ts
void streamResolution.resolve(currentItem, { autoPlay: true });
```

### Cómo `streamResolution.resolve()` maneja un skip

```ts
async resolve(item: QueueItem, options: ResolveOptions): Promise<void> {
  const signal = this.supersedeActiveResolution(item.id);
  // ...
  if (options.autoPlay) {
    useSoundStore.getState().stop();
    useSoundStore.getState().setSrc(null);
  }
  updateItemState(item.id, { status: 'loading', error: undefined });
  // ...fetch candidates, resolve stream...
  playbackManager.startTrack(item, audioSource, { autoPlay: options.autoPlay });
}
```

### Cómo se renderiza el audio en Android

`SoundProvider` renderiza `<Sound key={src.url} ...>` para audio normal, y `<YouTubeSound key={src.url} ...>` para YouTube. El `key` hace que React **desmonte** el componente anterior y monte uno nuevo cuando cambia la URL.

En Android, el rendering es en una **WebView de Android** (Tauri v2), que usa Chromium pero con restricciones de memoria y contexto de AudioContext más estrictas que un browser de escritorio.

---

## 2. Hipótesis ordenadas por probabilidad

### H1 — `updateItemState` falla porque el item fue reemplazado mientras la resolución estaba en vuelo ⭐⭐⭐ (MÁS PROBABLE)

**El problema:**

`streamResolution.resolve()` es asíncrono y hace múltiples `await`. Durante ese tiempo, si el usuario hace otro skip, `supersedeActiveResolution` aborta la resolución anterior. Pero hay una secuencia problemática:

1. Skip 1 → `goToNext()` → `set({ currentIndex: 1 })` → `resolve(itemA, autoPlay:true)`
2. Dentro de `resolve`: `updateItemState(itemA.id, { status: 'loading' })` — OK
3. Durante el `await candidatesForTrack(...)` el usuario hace otro Skip
4. Skip 2 → `goToNext()` → `set({ currentIndex: 2 })` → `supersedeActiveResolution` aborts señal de itemA
5. `supersedeActiveResolution` llama `updateItemState(itemA.id, { status: undefined, track: stripResolutionState(...) })`
6. **Pero** `itemA` ya puede no estar siendo el `currentItem`. `getItemById(itemA.id)` puede devolver el item pero con un `track` ya mutado por el `withPersistence` de `goToNext`

En Zustand con immer `produce`, si hay llamadas concurrentes a `set(produce(...))`, immer puede lanzar porque está intentando aplicar un draft sobre un estado que ya cambió. Esto en Android es más probable porque la WebView tiene menor tolerancia a excepciones en operaciones de I/O.

**Cómo testear:**  
Hacer skip muy rápido 2-3 veces seguido. Si el crash es más frecuente con skips rápidos, esta es la causa.

---

### H2 — `saveToDisk()` (persistencia a Tauri Store) falla durante el skip ⭐⭐⭐

**El problema:**

`goToNext()` y `goToPrevious()` están envueltos en `withPersistence`, que llama:
```ts
const saveToDisk = (): void => {
  persistenceQueue = persistenceQueue.then(async () => {
    try {
      const state = useQueueStore.getState();
      await store.set('queue.items', state.items);
      await store.set('queue.currentIndex', state.currentIndex);
      await store.save();
    } catch (error) {
      Logger.queue.error(`Failed to save queue: ${errorMessage(error)}`);
    }
  });
};
```

Esto parece seguro porque tiene `try/catch`. **Pero**: `persistenceQueue` es una variable de módulo. Si hay dos skips simultáneos, ambos encolan Promises en `persistenceQueue`. La segunda Promise puede leer `useQueueStore.getState()` cuando el estado ya es el del segundo skip, no el del primero. Esto no causa crash por sí solo.

**Sin embargo**, en Android, `@tauri-apps/plugin-store` (`LazyStore`) usa el sistema de archivos de Android. Si la app se está inicializando mientras se hace skip (o si hay un problema de permisos en el almacenamiento de Android), la llamada a `store.save()` puede lanzar una excepción que **no está capturada en el nivel de la Promise** que fue encadenada.

**Más importante:** `new LazyStore(QUEUE_FILE)` se instancia a nivel de módulo. En Android, el `appDataDir` puede no estar disponible hasta que Tauri termine de inicializar. Si el skip ocurre muy temprano, el `store` puede no estar listo.

**Cómo testear:**  
Ver si el crash ocurre siempre o solo en ciertos momentos (al inicio, después de volver de background, etc.)

---

### H3 — El `RootErrorBoundary` captura un error real de render causado por `currentItem` siendo `undefined` ⭐⭐

**El problema:**

`ConnectedNowPlayingModal` tiene este código:
```ts
const currentItem = useQueueStore((state) => state.getCurrentItem());
```

Y luego accede a propiedades sin null-checking en varios lugares:
```ts
const isPlaying = status === 'playing';
const artwork = pickArtwork(track?.artwork, ...) // OK, tiene optional chaining
```

Pero la llamada a `goToNext`/`goToPrevious` dentro del modal usa:
```ts
const { goToNext, goToPrevious } = useQueueStore(
  useShallow((state) => ({
    goToNext: state.goToNext,
    goToPrevious: state.goToPrevious,
  })),
);
```

Cuando se hace skip, el store cambia `currentIndex`. React re-renderiza `ConnectedNowPlayingModal`. Durante ese re-render, si `getCurrentItem()` devuelve `undefined` (porque el nuevo `currentIndex` apunta a un item que aún no existe — por ejemplo si la cola se agotó), hay código que asume que `currentItem` existe:

```ts
const track = currentItem?.track;  // undefined si currentItem es undefined
```

Esto tiene optional chaining, pero en el scrubber:
```ts
max={safeDuration || 1}
value={safePosition}
onChange={(e) => useSoundStore.getState().seekTo(Number(e.target.value))}
```

Parece seguro. Sin embargo, más abajo hay:
```ts
if (!track?.source) return;  // en handleToggleFavorite
```

Eso está protegido. El `RootErrorBoundary` en `App.tsx` devuelve `null` cuando `hasError` es true — la app queda en pantalla en blanco. El mensaje "Something went wrong" debe venir de otro lugar.

**Buscar:** el texto exacto "Something went wrong" en el codebase.

---

### H4 — El error viene del `@nuclearplayer/ui` PlayerBar o de un componente de UI, no del lógica de reproducción ⭐⭐

**El problema:**

El `RootErrorBoundary` captura errores de render y devuelve `null` (pantalla en blanco). Si la pantalla muestra "Something went wrong" en lugar de quedar en blanco, el mensaje **viene de algún componente de UI** que tiene su propio error boundary o manejo de error, no del `RootErrorBoundary` global.

Posibles orígenes:
- El package `@nuclearplayer/ui` puede tener su propio `ErrorBoundary` con ese mensaje
- TanStack Router puede mostrar ese mensaje en un error de ruta
- Algún componente de Sonner/toast puede estar mostrando ese mensaje como notificación

**Cómo verificar:**  
Buscar el texto en el codebase completo.

---

### H5 — `YouTubeSound` se desmonta mientras el player de YouTube aún está cargando ⭐⭐

**El problema en Android específicamente:**

En `SoundProvider`:
```tsx
{src && isYouTubeSource && status !== 'stopped' && (
  <YouTubeSound key={src.url} ... />
)}
```

Cuando se hace skip, `goToNext()` llama primero `useSoundStore.stop()` → `status = 'stopped'`. React deja de renderizar `YouTubeSound`. El cleanup de `useEffect` llama `playerRef.current?.destroy()`.

En Android WebView, la YouTube IFrame API puede comportarse distinto:
- La carga del script `youtube.com/iframe_api` puede estar bloqueada (Android puede bloquear iframes de YouTube por políticas de WebView)
- Si el script está bloqueado, `window.YT` nunca se define, `window.onYouTubeIframeAPIReady` nunca se llama, y la Promise de `loadYouTubeApi()` nunca resuelve (memory leak + comportamiento indefinido)

Pero más relevante para el crash: si la API **sí** cargó pero el `onReady` no disparó aún cuando se hace skip, el cleanup llama `playerRef.current.destroy()` sobre un player no inicializado. El SDK de YouTube IFrame puede lanzar en ese caso.

Sin embargo, el código tiene `try/catch` alrededor del destroy:
```ts
try {
  playerRef.current?.stopVideo();
  playerRef.current?.destroy();
} catch { }
```

Así que esto está protegido. **A menos que** la excepción venga de dentro del SDK de YouTube de manera asíncrona (un callback del SDK que lanza después del destroy).

---

### H6 — `useStreamResolution` re-dispara la resolución con el item incorrecto ⭐

**El problema:**

`useStreamResolution` usa un `resolutionKeyRef` para evitar resolver el mismo item dos veces:
```ts
const resolutionKey = buildResolutionKey(currentItem);
if (resolutionKey === resolutionKeyRef.current) {
  return;
}
resolutionKeyRef.current = resolutionKey;
```

La key se construye como `[item.id, headCandidate?.id, headCandidate?.failed].join(':')`.

Cuando se hace skip:
1. `goToNext()` llama `updateItemState` (via `stripResolutionState` en `supersedeActiveResolution`) que limpia los `streamCandidates` del item anterior
2. Esto dispara el subscriber de `useQueueStore` en `useStreamResolution`
3. Pero `state.getCurrentItem()` en ese momento ya es el **nuevo** item (porque `currentIndex` ya cambió)
4. La key del nuevo item es diferente → se inicia resolución del nuevo item ✓

Esto parece correcto, pero hay un edge case: si `supersedeActiveResolution` actualiza el item **anterior** (no el actual), eso también dispara el subscriber. El subscriber llama `state.getCurrentItem()` que devuelve el item actual. Si la resolución del nuevo item ya está en proceso, la verificación de key la detiene. Correcto.

El problema potencial aquí es sutil: hay una **doble llamada** a `stop()/setSrc(null)`:
1. `goToNext()` llama `stop()` + `setSrc(null)`
2. `streamResolution.resolve()` con `autoPlay:true` llama **otra vez** `stop()` + `setSrc(null)` al inicio

La segunda llamada no debería causar problema, pero en Android puede haber una condición de carrera si la WebView está procesando el primer `stop()` cuando llega el segundo.

---

## 3. Lo que necesitamos saber para reducir hipótesis

### 3.1 — ¿Cuál es el texto exacto del mensaje "Something went wrong"?

Este es el paso más importante. El mensaje exacto nos dice de qué componente viene.

**Buscar en el código:**
```bash
grep -r "Something went wrong\|went wrong\|Algo salió" \
  packages/ --include="*.tsx" --include="*.ts" --include="*.json" -i
```

Si el `RootErrorBoundary` es quien lo muestra, la pantalla quedaría **en blanco** (devuelve `null`). Si hay texto visible, viene de otro lugar.

### 3.2 — ¿Ocurre con todas las fuentes o solo con YouTube?

- Solo YouTube → H5
- Con cualquier proveedor → H1, H2, H3, H4

### 3.3 — ¿Ocurre solo con skip rápido o también con skip lento?

- Solo rápido (menos de 2 segundos entre skips) → H1 (race condition en AbortController/immer)
- Con cualquier velocidad → H2, H3, H4

### 3.4 — ¿En qué parte de la UI aparece el mensaje?

- Pantalla en blanco → `RootErrorBoundary` (H3)
- Un toast/notificación → algún `toast.error()`
- Un overlay/modal → componente de UI con su propio error boundary

### 3.5 — ¿El crash ocurre mientras el Now Playing Modal está abierto o desde el mini player?

Ambos llaman `goToNext()` directamente pero el modal también tiene `goToPrevious()` directo (sin el threshold de `playbackManager.previous()`). Esto puede ser relevante.

---

## 4. Plan de investigación

### Paso 1 — Encontrar el origen del mensaje "Something went wrong"

```bash
# En la raíz del proyecto:
grep -r "Something went wrong\|went wrong" packages/ --include="*.tsx" --include="*.ts" --include="*.json" -ri
```

Si el mensaje viene del `@nuclearplayer/ui` o de TanStack Router, eso cambia todo el análisis.

### Paso 2 — Revisar el manejo de la señal de abort en `streamResolution`

En `supersedeActiveResolution()`:
```ts
private supersedeActiveResolution(itemId: string): AbortSignal {
  if (this.activeController) {
    this.activeController.abort();
    if (this.activeItemId) {
      const { getItemById, updateItemState } = useQueueStore.getState();
      const previousItem = getItemById(this.activeItemId);
      if (previousItem) {
        updateItemState(this.activeItemId, {
          status: undefined,
          error: undefined,
          track: stripResolutionState(previousItem.track),
        });
      }
    }
  }
  this.activeController = new AbortController();
  this.activeItemId = itemId;
  return this.activeController.signal;
}
```

El problema potencial: `updateItemState` aquí se llama en medio de una resolución activa. `updateItemState` usa `withPersistence`, que encola `saveToDisk()`. Si `saveToDisk()` falla en Android (por el estado de inicialización de Tauri Store), la Promise rechazada puede burbujear.

### Paso 3 — Verificar si `persistenceQueue` puede acumular rejections

`saveToDisk` tiene `try/catch` interno, por lo que no debería rechazar. Pero si hay un error **fuera** del try/catch en la Promise (por ejemplo un error de TypeScript en runtime al serializar `state.items`), la Promise puede rechazar y `persistenceQueue` puede quedar en estado rejected, lo que haría que todos los `saveToDisk` subsiguientes fallen silenciosamente.

### Paso 4 — Verificar qué pasa cuando la cola se agota con skip

Si la cola tiene una sola canción y el usuario hace "next":
```ts
const nextIndex = getLinearIndex(state, 'forward');
if (nextIndex !== state.currentIndex) {
  // ... cambia de canción
} else {
  useSoundStore.getState().stop();
  useSoundStore.getState().setSrc(null);
  // currentIndex NO cambia
}
```

En este caso `currentIndex` no cambia, pero `setSrc(null)` sí se llama. El subscriber de `useStreamResolution` se dispara. `state.getCurrentItem()` devuelve el mismo item. La resolutionKey no cambió → no se resuelve de nuevo. Correcto.

Pero el `SoundProvider` con `src = null` no renderiza ni `Sound` ni `YouTubeSound`. Si el componente anterior aún estaba desmontándose con operaciones async en vuelo, puede haber un estado inconsistente.

---

## 5. Correcciones candidatas (una vez confirmada la causa)

### Fix para H1 (race condition en immer/store):
Asegurarse de que `supersedeActiveResolution` no llame a `updateItemState` si el item ya no es parte de la cola activa. Añadir un guard:
```ts
if (previousItem && previousItem.id !== useQueueStore.getState().getCurrentItem()?.id) {
  updateItemState(this.activeItemId, { ... });
}
```

### Fix para H2 (persistencia en Android):
Añadir logging más explícito y asegurarse de que `LazyStore` esté completamente inicializada antes del primer skip. El `initializeQueueStore()` ya llama `loadFromDisk()` que invoca el store, pero verificar que `store` esté lista antes de `set`.

### Fix para H4 (origen del mensaje):
Si viene del router de TanStack, añadir un error handler al router. Si viene de `@nuclearplayer/ui`, añadir un wrapper de Error Boundary alrededor de los componentes móviles críticos.

---

## 6. Archivos clave por hipótesis

| Archivo | Hipótesis |
|---------|-----------|
| `packages/player/src/services/streamResolution/streamResolution.ts` | H1 — race condition en supersedeActiveResolution |
| `packages/player/src/stores/queueStore.ts` | H2 — persistencia + withPersistence |
| `packages/player/src/components/ConnectedPlayerBar/ConnectedNowPlayingModal.tsx` | H3, H4 — render con currentItem undefined |
| `packages/player/src/App.tsx` | H4 — RootErrorBoundary vs mensaje de otro lugar |
| `packages/player/src/components/YouTubeSound.tsx` | H5 — destroy antes de onReady en Android WebView |
| `packages/player/src/components/ConnectedPlayerBar/ConnectedFloatingMiniPlayer.tsx` | H3 — goToNext sin playbackManager |

---

## 7. Inconsistencias encontradas en el código (independientes del crash)

### 7.1 — Bypass del threshold de "anterior" en Android

`ConnectedNowPlayingModal` y `ConnectedFloatingMiniPlayer` llaman `goToNext()`/`goToPrevious()` **directamente**, mientras que `ConnectedControls` (escritorio) usa `playbackManager.previous()` que tiene el threshold de 3 segundos (si llevas más de 3 segundos en la canción, "anterior" reinicia en lugar de ir a la canción previa).

En Android, presionar "anterior" siempre va a la canción anterior, sin importar el tiempo transcurrido. Puede ser intencional, pero vale la pena verificar.

### 7.2 — `ConnectedNowPlayingModal` importa `goToNext`/`goToPrevious` del store directamente

Esto hace que los botones del modal no pasen por `playbackManager`, que es el coordinador central del estado de reproducción. Si `playbackManager` tiene lógica relevante (como el `playRequested` flag), saltarla podría causar estados inconsistentes.

Concretamente: `playbackManager.previous()` llama `useQueueStore.getState().goToPrevious()` internamente — no hay diferencia funcional en ir directo. Pero `goToNext()` en el modal tampoco pasa por `playbackManager`. Si en algún momento `playbackManager` añade lógica pre-skip (como verificar si hay un stream en carga), el modal se la saltaría.
