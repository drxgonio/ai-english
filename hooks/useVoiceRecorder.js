"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { isRecordingSupported, pickSupportedMimeType } from "@/lib/audio";
import { MAX_RECORDING_MS, MIN_RECORDING_MS } from "@/lib/constants";

const MIN_BLOB_BYTES = 1200;
const LEVEL_UPDATE_INTERVAL_MS = 80;
const TIMER_INTERVAL_MS = 100;

/** Maps DOMException names from getUserMedia/MediaRecorder to human copy. */
export function describeMicrophoneError(error) {
  switch (error?.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "Microphone access was blocked. Allow it in your browser's site settings (the lock icon in the address bar), then try again.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No microphone was found. Connect one and try again.";
    case "NotReadableError":
    case "TrackStartError":
      return "Your microphone is being used by another app. Close it and try again.";
    case "OverconstrainedError":
      return "Your microphone does not support the requested audio settings.";
    case "AbortError":
      return "Recording was interrupted. Please try again.";
    default:
      return error?.message || "We could not access your microphone.";
  }
}

/**
 * Encapsulates the whole MediaRecorder lifecycle:
 * permission -> recording -> finalize (blob) -> cleanup.
 *
 * `onComplete(blob, { durationMs, mimeType })` is only called for valid,
 * non-discarded recordings. State is intentionally local so several components
 * can render from a single source of truth.
 */
export function useVoiceRecorder({
  maxDurationMs = MAX_RECORDING_MS,
  minDurationMs = MIN_RECORDING_MS,
  onComplete,
  vad,
} = {}) {
  const [status, setStatus] = useState("idle"); // idle | requesting | recording | stopping
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState(null);
  const [mimeType, setMimeType] = useState("");
  const [isSupported, setIsSupported] = useState(null);

  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const startingRef = useRef(false);
  const chunksRef = useRef([]);
  const mimeRef = useRef("");
  const startedAtRef = useRef(0);
  const discardRef = useRef(false);
  const timerRef = useRef(null);
  const rafRef = useRef(null);
  const meterContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const analyserRef = useRef(null);

  // Voice-activity detection (continuous "auto-talk" mode). Refs are kept in a
  // ref so callbacks/config stay fresh without re-creating the rAF loop.
  const vadRef = useRef({
    enabled: false,
    silenceMs: 1400,
    threshold: 0.045,
    onSilence: null,
    onSpeech: null,
  });
  const vadStateRef = useRef({ heard: false, lastSpeechAt: 0, fired: false });

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    setIsSupported(isRecordingSupported());
  }, []);

  // Keep the VAD configuration/callbacks current on every render.
  useEffect(() => {
    vadRef.current = {
      enabled: Boolean(vad?.enabled),
      silenceMs: vad?.silenceMs ?? 1400,
      threshold: vad?.threshold ?? 0.045,
      onSilence: vad?.onSilence ?? null,
      onSpeech: vad?.onSpeech ?? null,
    };
  }, [vad]);

  const cleanupResources = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    try {
      sourceNodeRef.current?.disconnect();
    } catch {
      /* noop */
    }
    sourceNodeRef.current = null;

    try {
      analyserRef.current?.disconnect();
    } catch {
      /* noop */
    }
    analyserRef.current = null;

    const meterContext = meterContextRef.current;
    meterContextRef.current = null;
    if (meterContext && meterContext.state !== "closed") {
      meterContext.close().catch(() => {});
    }

    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        /* noop */
      }
    });

    recorderRef.current = null;
    startingRef.current = false;
    setLevel(0);
  }, []);

  /** Builds the blob and hands it to the caller. Runs from recorder.onstop. */
  const finalize = useCallback(() => {
    const chunks = chunksRef.current;
    const mime = mimeRef.current || chunks[0]?.type || "audio/webm";
    const blob = chunks.length ? new Blob(chunks, { type: mime }) : null;
    const durationMs = Math.max(
      0,
      Math.round(performance.now() - startedAtRef.current),
    );
    const discarded = discardRef.current;

    chunksRef.current = [];
    discardRef.current = false;
    cleanupResources();
    setStatus("idle");
    setElapsedMs(0);

    if (discarded) return;

    if (!blob || blob.size === 0) {
      setError(
        "We didn't capture any audio. Check your microphone and try again.",
      );
      return;
    }
    if (durationMs < minDurationMs || blob.size < MIN_BLOB_BYTES) {
      // In continuous mode a cough or a door slam is not worth an error popup:
      // just tell the loop to go back to listening.
      if (vadRef.current.enabled) {
        vadRef.current.onDiscard?.();
      } else {
        setError(
          "That was too short — hold the microphone and speak a full sentence.",
        );
      }
      return;
    }

    try {
      onCompleteRef.current?.(blob, { durationMs, mimeType: blob.type });
    } catch {
      setError("We could not send that recording. Please try again.");
    }
  }, [cleanupResources, minDurationMs]);

  /** Live input meter (RMS) — purely cosmetic, so failures are swallowed. */
  const startMeter = useCallback((stream) => {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;

    try {
      const context = new AudioContextCtor();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);

      meterContextRef.current = context;
      sourceNodeRef.current = source;
      analyserRef.current = analyser;

      const samples = new Uint8Array(analyser.frequencyBinCount);
      let lastUpdate = 0;

      const tick = () => {
        const node = analyserRef.current;
        if (!node) return;

        node.getByteTimeDomainData(samples);
        let sum = 0;
        for (let i = 0; i < samples.length; i += 1) {
          const value = (samples[i] - 128) / 128;
          sum += value * value;
        }
        const rms = Math.sqrt(sum / samples.length);
        const now = performance.now();

        // Voice-activity detection: remember when we last heard the user, and
        // fire `onSilence` once the voice has been quiet long enough.
        const vad = vadRef.current;
        if (vad.enabled) {
          const state = vadStateRef.current;
          if (rms >= vad.threshold) {
            if (!state.heard) {
              state.heard = true;
              vad.onSpeech?.();
            }
            state.lastSpeechAt = now;
          }
          if (
            !state.fired &&
            state.heard &&
            now - state.lastSpeechAt >= vad.silenceMs
          ) {
            state.fired = true;
            vad.onSilence?.();
          }
        }

        if (now - lastUpdate >= LEVEL_UPDATE_INTERVAL_MS) {
          lastUpdate = now;
          const next = Math.min(1, rms * 4.5);
          setLevel((previous) =>
            Math.abs(previous - next) > 0.02 ? next : previous,
          );
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch {
      /* the meter is optional — recording continues without it */
    }
  }, []);

  /** Stop recording and deliver the blob to `onComplete`. */
  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    setStatus("stopping");
    try {
      // `requestData` flushes the final chunk on browsers that buffer it.
      if (recorder.state === "recording") recorder.requestData?.();
      recorder.stop();
    } catch {
      discardRef.current = true;
      cleanupResources();
      setStatus("idle");
      setElapsedMs(0);
      setError("Recording stopped unexpectedly. Please try again.");
    }
  }, [cleanupResources]);

  const stopRef = useRef(stop);
  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  /** Abort the current take without producing a blob. */
  const cancel = useCallback(() => {
    discardRef.current = true;
    const recorder = recorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
        return;
      } catch {
        /* fall through to manual cleanup */
      }
    }

    cleanupResources();
    setStatus("idle");
    setElapsedMs(0);
  }, [cleanupResources]);

  const start = useCallback(async () => {
    if (recorderRef.current || startingRef.current) return; // already recording or acquiring permission

    setError(null);

    if (
      typeof window === "undefined" ||
      typeof window.MediaRecorder === "undefined"
    ) {
      setError(
        "This browser cannot record audio. Try the latest Chrome, Edge, Firefox or Safari.",
      );
      return;
    }
    if (!navigator?.mediaDevices?.getUserMedia) {
      setError(
        "Microphone access is unavailable. Open the app over HTTPS or on http://localhost.",
      );
      return;
    }
    if (window.isSecureContext === false) {
      setError(
        "Microphone access requires HTTPS (or localhost). Reload over a secure URL.",
      );
      return;
    }

    setStatus("requesting");
    setElapsedMs(0);
    setLevel(0);
    vadStateRef.current = { heard: false, lastSpeechAt: 0, fired: false };
    startingRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const preferredMime = pickSupportedMimeType();
      const recorder = preferredMime
        ? new MediaRecorder(stream, {
            mimeType: preferredMime,
            audioBitsPerSecond: 128_000,
          })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      startingRef.current = false;

      mimeRef.current = recorder.mimeType || preferredMime || "audio/webm";
      setMimeType(mimeRef.current);
      chunksRef.current = [];
      discardRef.current = false;
      startedAtRef.current = performance.now();

      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };

      recorder.onerror = (event) => {
        console.error("[recorder] error:", event?.error);
        discardRef.current = true;
        setError(describeMicrophoneError(event?.error));
        try {
          recorder.stop();
        } catch {
          cleanupResources();
          setStatus("idle");
        }
      };

      recorder.onstop = () => finalize();

      // A 250 ms timeslice gives us chunks even if the tab is backgrounded.
      recorder.start(250);
      setStatus("recording");

      startMeter(stream);

      timerRef.current = setInterval(() => {
        const elapsed = performance.now() - startedAtRef.current;
        setElapsedMs(Math.min(elapsed, maxDurationMs));
        if (elapsed >= maxDurationMs) stopRef.current();
      }, TIMER_INTERVAL_MS);
    } catch (caught) {
      startingRef.current = false;
      cleanupResources();
      setStatus("idle");
      setElapsedMs(0);
      setError(describeMicrophoneError(caught));
    }
  }, [cleanupResources, finalize, maxDurationMs, startMeter]);

  // Release the microphone if the component unmounts mid-recording.
  useEffect(() => {
    return () => {
      discardRef.current = true;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          /* noop */
        }
      }
      cleanupResources();
    };
  }, [cleanupResources]);

  return {
    status,
    elapsedMs,
    level,
    error,
    mimeType,
    isSupported,
    start,
    stop,
    cancel,
    clearError: useCallback(() => setError(null), []),
  };
}
