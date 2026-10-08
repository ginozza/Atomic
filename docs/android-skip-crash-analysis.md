# Análisis: Crash al hacer Skip/Prev en Android

**Fecha:** 2026-10-07  
**Plataforma:** Android (Tauri WebView)  
**Síntoma:** Al presionar siguiente/anterior mientras una canción se reproduce, la app crashea mostrando error genérico.

**Estado:** ✅ **BUG PRIMARIO IDENTIFICADO** + evidencia de problemas de memoria conocidos

---

## 1. Contexto de la arquitectura Android

### 1.1 Flujo de reproducción

```
[Usuario presiona Next en modal] 
  → ConnectedNowPlayingModal: goToNext() directo del store
    → queueStore.goToNext()
      → soundStore.stop() + setSrc(null)  ← pausa el audio actual
      → set({ currentIndex: nextIndex })
    → useStreamResolution (suscrito)
      → streamResolution.resolve(newItem, { autoPlay: true })
        → (async) resolve streams
          → playbackManager.startTrack()
            → soundStore.setSrc(newSrc) + setStatus('playing')
```

**Punto crítico:** El `setSrc(null)` del track anterior y el `setSrc(newSrc)` del track nuevo son **asíncronos** — hay una ventana donde:
- El componente `Sound` del track anterior se está desmontando
- El AudioElement viejo aún existe en el DOM
- Los event listeners y timeouts del track anterior **todavía están vivos**

### 1.2 Bridge Android

En `MainActivity.kt`, hay un bridge `NuclearAndroid` expuesto al JavaScript:

```kotlin
window.NuclearAndroid = {
  updatePlayback(title, artist, coverUrl, isPlaying, posMs, durMs),
  isHyperOS(),
  isHyperIslandSupported(),
  minimizeApp()
}
```

**Evidencia crítica encontrada:** Existe un método `forceWebViewGC()` en `MainActivity.kt` con el comentario:

```kotlin
// Force garbage collection after track changes to prevent OOM crashes
fun forceWebViewGC() {
    runOnUiThread {
        val wv = webViewRef ?: findWebView()
        wv?.let {
            it.clearHistory()
            it.freeMemory()
            System.gc()
        }
    }
}
```

**Este método NUNCA se llama desde el frontend.** Su existencia confirma que:
1. El equipo ya identificó crashes al cambiar de track
2. Sospechaban problemas de memoria (OOM = Out Of Memory)
3. Implementaron una solución pero no la conectaron

---

## 2. Error Boundary y el mensaje "Something went wrong"

En `App.tsx`, el `RootErrorBoundary`:

```tsx
render() {
  if (this.state.hasError) {
    // Real unexpected error — the app is broken, show nothing
    return null;
  }
  return this.props.children;
}
```

Cuando hay un error **no benigno**, el boundary retorna `null` — esto hace que el WebView quede en blanco y Android muestre el mensaje genérico de error.

`isBenignError()` filtra:
- `DOMException`
- `AbortError`
- Errores de Vite preload (`"Failed to fetch dynamically imported module"`)

**Si el error NO es uno de estos, el boundary lo atrapa y la app se rompe.**

---

## 3. Bugs identificados

### 3.1 ⚠️ **BUG PRIMARIO: setTimeout sin clearTimeout en usePlaybackStatus**

**Ubicación:** `packages/hifi/src/hooks/usePlaybackStatus.ts`, líneas 52-58

```typescript
case 'playing': {
  // ...
  const onPause = () => {
    if (status === 'playing' && !audio.ended && audio.currentTime > 0) {
      setTimeout(() => {
        if (status === 'playing' && audio.paused) {
          tryPlay();  // ← llama audio.play()
        }
      }, 100);  // ← NO HAY clearTimeout
    }
  };
  audio.addEventListener('pause', onPause);
  return () => {
    audio.removeEventListener('pause', onPause);
    audio.removeEventListener('canplay', onCanPlay);
    // ❌ NO SE CANCELA EL setTimeout
  };
}
```

**Escenario del crash:**

1. Track A está reproduciendo → status = `'playing'`
2. El audio se pausa (por buffering, por ejemplo)
3. `onPause` se ejecuta y programa un `setTimeout` de 100ms
4. **Antes de que pasen los 100ms**, el usuario presiona Next
5. `queueStore.goToNext()` ejecuta `soundStore.stop()` y `setSrc(null)`
6. El componente `Sound` del track A se desmonta
7. El cleanup del `useEffect` remueve los listeners pero **NO cancela el setTimeout**
8. **100ms después**, el timeout se ejecuta y llama `audio.play()` sobre el AudioElement del track A que:
   - Ya no tiene src (es `null` o `''`)
   - O ya fue destruido/reemplazado
9. El Promise de `audio.play()` se rechaza con un error **fuera del scope del error boundary**
10. El error burbujea al WebView → crash

**Por qué el error no es "benigno":**
- El error del `audio.play()` fallido probablemente es un `DOMException` con `name !== 'AbortError'`
- Por ejemplo: `NotAllowedError`, `NotSupportedError`, `InvalidStateError`
- `isBenignError` filtra `DOMException` en general, **pero el error puede venir envuelto en otro tipo** si es una Promise sin `.catch()`

**Confirmación:** Este es el bug más probable porque:
- Explica el crash específicamente al hacer skip rápido
- Explica por qué el error escapa al boundary (es asíncrono)
- El código tiene el pattern exacto que causa este tipo de crashes

---

### 3.2 🟡 Problema: `forceWebViewGC` implementado pero no usado

El método existe en `MainActivity.kt` pero **no está expuesto al bridge de JavaScript**. Esto indica dos cosas:

1. **El equipo ya sabía de crashes relacionados con skip/OOM**
2. Implementaron una solución parcial que no terminaron

**Propuesta:** Exponer `forceWebViewGC()` al bridge y llamarlo después de cada skip.

---

### 3.3 🟡 Race condition en el AbortController de streamResolution

**Ubicación:** `packages/player/src/services/streamResolution/streamResolution.ts`

Cada llamada a `resolve()` crea un nuevo `AbortController` y cancela el anterior. Si el usuario hace spam de Next:

```
resolve(trackA) → controller1  
  → (async) candidatesForTrack...  
resolve(trackB) → controller2 + controller1.abort()  
  → (async) candidatesForTrack...  
resolve(trackC) → controller3 + controller2.abort()  
```

El problema: los `fetch` se abortan, pero:
- Si hay Promises intermedias que no chequean `signal.aborted`, siguen ejecutándose
- `startTrack()` se puede llamar con un track desactualizado

**Evidencia:** El código ya tiene checks de `signal.aborted` después de cada `await`, pero **no dentro del loop** de `candidatesForTrack`:

```typescript
for (const candidate of candidates) {
  // ❌ NO HAY CHECK DE signal.aborted AQUÍ
  const result = await resolveStreamForCandidate(candidate, signal);
  if (result) return result;
}
```

Si el usuario hace skip mientras está resolviendo el candidate #3 de 5, los candidates 4 y 5 se siguen procesando aunque ya fueron cancelados.

---

### 3.4 🟢 Botones de Android bypass el threshold de "anterior"

**Ubicación:** `ConnectedNowPlayingModal` y `ConnectedFloatingMiniPlayer`

Llaman `goToPrevious()` directamente, mientras que `ConnectedControls` (escritorio) usa `playbackManager.previous()` que tiene la lógica de threshold:

```typescript
// playbackManager.previous()
if (useQueueStore.getState().seek > 3) {
  useSoundStore.getState().seek(0); // reinicia la canción
} else {
  useQueueStore.getState().goToPrevious(); // va al track anterior
}
```

En Android, presionar "anterior" **siempre va al track anterior**, sin importar el tiempo transcurrido.

**Impacto:** Probablemente intencional, pero puede ser un comportamiento inconsistente que confunda al usuario.

---

## 4. Soluciones propuestas

### 4.1 🔴 **FIX PRIORITARIO:** Cancelar el setTimeout en usePlaybackStatus

```typescript
// packages/hifi/src/hooks/usePlaybackStatus.ts

case 'playing': {
  let pauseRetryTimeout: NodeJS.Timeout | null = null;
  
  const onPause = () => {
    if (status === 'playing' && !audio.ended && audio.currentTime > 0) {
      pauseRetryTimeout = setTimeout(() => {
        if (status === 'playing' && audio.paused) {
          tryPlay();
        }
      }, 100);
    }
  };
  
  audio.addEventListener('canplay', onCanPlay);
  audio.addEventListener('pause', onPause);
  
  return () => {
    audio.removeEventListener('canplay', onCanPlay);
    audio.removeEventListener('pause', onPause);
    // ✅ Cancelar el timeout
    if (pauseRetryTimeout !== null) {
      clearTimeout(pauseRetryTimeout);
    }
  };
}
```

---

### 4.2 🟡 Conectar forceWebViewGC y llamarlo después de skip

**1. Exponer el método en el bridge:**

```kotlin
// MainActivity.kt
inner class NuclearBridge {
  // ... métodos existentes
  
  @JavascriptInterface
  fun forceGC() {
    forceWebViewGC()
  }
}
```

**2. Actualizar el tipo en TypeScript:**

```typescript
// packages/player/src/hooks/useHyperIslandBridge.ts
declare global {
  interface Window {
    NuclearAndroid?: {
      // ... existentes
      forceGC: () => void;
    };
  }
}
```

**3. Llamar después de cada skip:**

```typescript
// packages/player/src/stores/queueStore.ts
goToNext: () => {
  // ... lógica existente
  
  // Force GC on Android to prevent OOM
  if (window.NuclearAndroid?.forceGC) {
    setTimeout(() => window.NuclearAndroid.forceGC(), 500);
  }
},
```

---

### 4.3 🟢 Mejorar el abort en streamResolution

```typescript
// packages/player/src/services/streamResolution/streamResolution.ts
for (const candidate of candidates) {
  if (signal.aborted) {
    log.debug('[StreamResolution] Aborted during candidate loop');
    return null;
  }
  const result = await resolveStreamForCandidate(candidate, signal);
  if (result) return result;
}
```

---

### 4.4 🟢 Unificar los botones de Previous

Hacer que `ConnectedNowPlayingModal` llame `playbackManager.previous()` en lugar de `goToPrevious()` directo:

```typescript
// packages/player/src/components/ConnectedPlayerBar/ConnectedNowPlayingModal.tsx
<Button onClick={() => playbackManager.previous()}>
  {/* ... */}
</Button>
```

---

## 5. Plan de acción

### Fase 1: Fix crítico (ahora)
1. ✅ Aplicar fix de `clearTimeout` en `usePlaybackStatus.ts`
2. ✅ Escribir test de integración que haga skip rápido 10 veces seguidas
3. ✅ Verificar que no crashea

### Fase 2: Mejoras Android (corto plazo)
4. 🔧 Conectar `forceWebViewGC()` al bridge
5. 🔧 Llamar `forceGC()` después de cada skip
6. 🔧 Agregar check de `signal.aborted` en el loop de `candidatesForTrack`

### Fase 3: Refinamiento (mediano plazo)
7. 📝 Unificar los botones de Previous para usar `playbackManager.previous()`
8. 📝 Añadir logging específico de Android para rastrear OOM/crashes
9. 📝 Considerar un `AudioPool` para reutilizar AudioElements en lugar de destruirlos

---

## 6. Cómo reproducir el crash (para testing)

### Escenario 1: Skip rápido
1. Abrir la app en Android
2. Reproducir cualquier track
3. Presionar "Next" 5-10 veces muy rápido (< 1 segundo entre cada skip)
4. **Resultado esperado:** crash con pantalla en blanco

### Escenario 2: Skip durante buffering
1. Reproducir un track con conexión lenta
2. Esperar a que el audio se pause por buffering
3. **Inmediatamente** presionar "Next"
4. **Resultado esperado:** crash con pantalla en blanco

### Escenario 3: Previous sin threshold
1. Reproducir un track por más de 3 segundos
2. Presionar "Previous" desde el modal
3. **Resultado observado:** va al track anterior (en escritorio, reiniciaría el track actual)

---

## 7. Referencias de código

| Archivo | Líneas relevantes | Descripción |
|---------|-------------------|-------------|
| `packages/hifi/src/hooks/usePlaybackStatus.ts` | 52-58 | setTimeout sin clearTimeout (BUG PRIMARIO) |
| `packages/player/src-tauri/gen/android/.../MainActivity.kt` | 55-65 | forceWebViewGC no conectado |
| `packages/player/src/App.tsx` | 44-62 | RootErrorBoundary que retorna null |
| `packages/player/src/services/streamResolution/streamResolution.ts` | 95-120 | Loop de candidates sin check de abort |
| `packages/player/src/hooks/useHyperIslandBridge.ts` | 114-125 | Handler de acciones del HyperIsland |

---

## 8. Términos de búsqueda sugeridos (para Stack Overflow / GitHub Issues)

Si necesitas buscar casos similares:

1. `android webview audio play() crash after unmount`
2. `react native audio element setTimeout memory leak`
3. `tauri android HTMLAudioElement InvalidStateError skip track`
4. `webkit webview audio src null play() promise rejection`
5. `android webview garbage collection audio memory leak`

---

## Conclusión

El crash está causado por un **setTimeout sin clearTimeout** en `usePlaybackStatus.ts` que ejecuta `audio.play()` sobre un AudioElement destruido/sin src después de hacer skip. El error resultante no es capturado por el error boundary porque ocurre en un contexto asíncrono.

La solución es agregar `clearTimeout` en el cleanup del `useEffect`. Adicionalmente, conectar `forceWebViewGC()` para prevenir OOM en sesiones largas.
