/**
 * Browser-only helpers for recording formats and audio playback through the
 * Web Audio API. Every function guards against server-side execution so the
 * module can be imported freely.
 */

/** Ordered by preference; Safari only supports mp4/aac, Chrome prefers opus. */
export const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
  "audio/aac",
  "audio/mpeg",
];

export function isRecordingSupported() {
  if (typeof window === "undefined") return false;
  return Boolean(
    typeof window.MediaRecorder !== "undefined" &&
      navigator?.mediaDevices?.getUserMedia,
  );
}

/** First MIME type the current browser can actually record, or "" to let the browser decide. */
export function pickSupportedMimeType() {
  const MediaRecorderCtor =
    typeof window !== "undefined" ? window.MediaRecorder : undefined;
  if (!MediaRecorderCtor?.isTypeSupported) return "";

  return (
    PREFERRED_MIME_TYPES.find((type) => {
      try {
        return MediaRecorderCtor.isTypeSupported(type);
      } catch {
        return false;
      }
    }) || ""
  );
}

/** Maps a recorder MIME type to a filename Whisper will accept. */
export function extensionForMime(mime = "") {
  const value = String(mime).toLowerCase();
  if (value.includes("webm")) return "webm";
  if (value.includes("ogg")) return "ogg";
  if (value.includes("mp4") || value.includes("m4a") || value.includes("aac"))
    return "m4a";
  if (value.includes("mpeg") || value.includes("mp3")) return "mp3";
  if (value.includes("wav")) return "wav";
  return "webm";
}

/** Readable label for the UI ("webm/opus" → "Opus · WebM"). */
export function describeMimeType(mime = "") {
  const value = String(mime).toLowerCase();
  if (value.includes("webm")) return "Opus · WebM";
  if (value.includes("ogg")) return "Opus · OGG";
  if (value.includes("mp4") || value.includes("m4a") || value.includes("aac"))
    return "AAC · MP4";
  if (value.includes("mpeg") || value.includes("mp3")) return "MP3";
  return "Audio";
}

/* -------------------------------------------------------------------------- */
/* Playback                                                                   */
/* -------------------------------------------------------------------------- */

let playbackContext = null;
let activePlayback = null;

/** How often the lip-sync level is pushed to React (ms) — 60 ms ≈ 16 fps. */
const LEVEL_UPDATE_INTERVAL_MS = 60;

export function getPlaybackContext() {
  if (typeof window === "undefined") return null;
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return null;

  if (!playbackContext || playbackContext.state === "closed") {
    playbackContext = new AudioContextCtor();
  }
  return playbackContext;
}

/** Must be called from a user gesture once, to unlock audio on iOS/Safari. */
export async function primeAudioPlayback() {
  const context = getPlaybackContext();
  if (!context) return false;
  if (context.state === "suspended") {
    try {
      await context.resume();
    } catch {
      return false;
    }
  }
  return context.state === "running";
}

export function stopPlayback() {
  if (!activePlayback) return;
  const { source, rafId, onLevel } = activePlayback;
  activePlayback = null;

  if (rafId) cancelAnimationFrame(rafId);

  try {
    source.onended = null;
    source.stop();
  } catch {
    /* already stopped */
  }
  try {
    source.disconnect();
  } catch {
    /* noop */
  }

  onLevel?.(0);
}

/**
 * Decodes an MP3 response and plays it through the AudioContext.
 * `onLevel(0..1)` reports the live output amplitude so an avatar can lip-sync.
 * Resolves when playback finishes (or is stopped).
 */
export async function playAudioBuffer(
  arrayBuffer,
  { onStart, onEnded, onLevel } = {},
) {
  const context = getPlaybackContext();
  if (!context)
    throw new Error("This browser does not support the Web Audio API.");

  if (context.state === "suspended") await context.resume();

  // `decodeAudioData` detaches the buffer, hence the defensive copy.
  const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
  stopPlayback();

  const source = context.createBufferSource();
  const gain = context.createGain();
  gain.gain.value = 1;
  source.buffer = decoded;

  // An analyser taps the audio for the lip-sync level without affecting output.
  const analyser = onLevel ? context.createAnalyser() : null;
  if (analyser) {
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.7;
    source.connect(analyser);
    analyser.connect(gain);
  } else {
    source.connect(gain);
  }
  gain.connect(context.destination);

  let rafId = null;

  if (analyser) {
    const samples = new Uint8Array(analyser.fftSize);
    let lastUpdate = 0;

    const tick = () => {
      const now = performance.now();
      if (now - lastUpdate >= LEVEL_UPDATE_INTERVAL_MS) {
        lastUpdate = now;
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (let i = 0; i < samples.length; i += 1) {
          const value = (samples[i] - 128) / 128;
          sum += value * value;
        }
        const rms = Math.sqrt(sum / samples.length);
        onLevel(Math.min(1, rms * 5));
      }
      rafId = requestAnimationFrame(tick);
      if (activePlayback) activePlayback.rafId = rafId;
    };

    rafId = requestAnimationFrame(tick);
  }

  activePlayback = { source, gain, rafId, onLevel };

  return new Promise((resolve) => {
    const finish = () => {
      if (activePlayback?.source === source) activePlayback = null;
      if (rafId) cancelAnimationFrame(rafId);
      try {
        source.disconnect();
        analyser?.disconnect();
        gain.disconnect();
      } catch {
        /* noop */
      }
      onLevel?.(0);
      onEnded?.();
      resolve();
    };

    source.onended = finish;
    onStart?.();
    source.start(0);
  });
}

export function isPlaybackActive() {
  return Boolean(activePlayback);
}
