"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ChatPanel from "@/components/ChatPanel";
import FeedbackPanel from "@/components/FeedbackPanel";
import RecorderDock from "@/components/RecorderDock";
import TopBar from "@/components/TopBar";
import { MessageIcon, SparklesIcon } from "@/components/icons";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import {
  extensionForMime,
  playAudioBuffer,
  primeAudioPlayback,
  stopPlayback,
} from "@/lib/audio";
import {
  COACH,
  DEFAULT_LEVEL,
  DEFAULT_MODE,
  DEFAULT_PERSONA_ID,
  DEFAULT_TOPIC,
  LEVEL_VALUES,
  MAX_CONTEXT_TURNS,
  MAX_RECORDING_MS,
  MAX_STORED_TURNS,
  MODES,
  PERSONAS,
  STORAGE_KEY,
  TOPICS,
  findPersona,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Stable-enough id for optimistic/turn rendering. */
function newId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `turn-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Guards against a corrupted/older localStorage payload. */
function isStoredTurn(turn) {
  return Boolean(
    turn &&
      typeof turn.id === "string" &&
      typeof turn.transcript === "string" &&
      typeof turn.aiSpeech === "string" &&
      turn.feedback &&
      typeof turn.feedback === "object",
  );
}

/** Short rolling context so the coach remembers the conversation. */
function buildHistory(turns) {
  return turns.slice(-MAX_CONTEXT_TURNS).flatMap((turn) => [
    { role: "user", text: turn.transcript },
    { role: "assistant", text: turn.aiSpeech },
  ]);
}

function toClientError(payload, status) {
  const message =
    payload?.error?.message ||
    (status === 0
      ? "You appear to be offline. Check your connection and try again."
      : `The request failed (HTTP ${status}). Please try again.`);

  const error = new Error(message);
  error.code = payload?.error?.code;
  error.status = status;
  return error;
}

/* -------------------------------------------------------------------------- */
/* Continuous ("auto-talk") conversation                                      */
/* -------------------------------------------------------------------------- */

/** Silence after speech that marks the end of your turn. */
const TURN_SILENCE_MS = 1500;
/** Input RMS above this counts as speech (mic is echo-cancelled + noise-suppressed). */
const SPEECH_THRESHOLD = 0.045;
/** If you stay silent this long, the partner nudges the conversation once. */
const LISTEN_NUDGE_MS = 25_000;

function greetingFor(speaker) {
  return speaker.name === COACH.name
    ? "Hi! I'm Ava, your English coach. Let's practise — tell me how your day is going."
    : `Hi, I'm ${speaker.name}! Great to meet you. What would you like to talk about today?`;
}

function nudgeFor(speaker) {
  return speaker.name === COACH.name
    ? "Take your time — I'm still here. Tell me anything that's on your mind."
    : "No rush, I'm still here. Ask me anything, or tell me more.";
}

export default function SpeakPage() {
  /* ---------------------------------------------------------------------- */
  /* State                                                                   */
  /* ---------------------------------------------------------------------- */
  const [turns, setTurns] = useState([]);
  const [activeTurnId, setActiveTurnId] = useState(null);
  const [level, setLevel] = useState(DEFAULT_LEVEL);
  const [topic, setTopic] = useState(DEFAULT_TOPIC);
  const [mode, setMode] = useState(DEFAULT_MODE);
  const [personaId, setPersonaId] = useState(DEFAULT_PERSONA_ID);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [handsFree, setHandsFree] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  // Lip-sync amplitude (0..1) of the voice currently playing, plus its text.
  const [speakingLevel, setSpeakingLevel] = useState(0);
  const [speakingText, setSpeakingText] = useState("");
  const [pendingLabel, setPendingLabel] = useState(null);
  const [error, setError] = useState(null);
  const [mobileTab, setMobileTab] = useState("chat");
  const [hydrated, setHydrated] = useState(false);
  // Continuous talk: the app listens, detects the end of your turn, replies and
  // listens again — hands-free, like talking to a real person.
  const [continuous, setContinuous] = useState(false);
  const [loopPaused, setLoopPaused] = useState(false);

  const requestAbortRef = useRef(null);
  const speakAbortRef = useRef(null);
  const retryRef = useRef(null);
  const cancelOnStartRef = useRef(false);
  const pressActiveRef = useRef(false);
  const pendingTimerRef = useRef(null);
  const continuousRef = useRef(false);
  const loopPausedRef = useRef(false);
  const listenTimerRef = useRef(null);
  const heardSpeechRef = useRef(false);
  const nudgedRef = useRef(false);
  const stopRecorderRef = useRef(null);
  const afterSpeakRef = useRef(() => {});
  const startRecorderRef = useRef(null);
  const cancelRecorderRef = useRef(null);
  const beginListeningRef = useRef(null);
  const speakerRef = useRef(null);

  /* ---------------------------------------------------------------------- */
  /* Session persistence (localStorage, hydration-safe)                      */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        const restored = Array.isArray(saved?.turns)
          ? saved.turns.filter(isStoredTurn)
          : [];

        if (restored.length) {
          setTurns(restored.slice(-MAX_STORED_TURNS));
          setActiveTurnId(
            restored.some((turn) => turn.id === saved.activeTurnId)
              ? saved.activeTurnId
              : restored[restored.length - 1].id,
          );
        }
        if (LEVEL_VALUES.includes(saved?.level)) setLevel(saved.level);
        if (TOPICS.includes(saved?.topic)) setTopic(saved.topic);
        if (typeof saved?.ttsEnabled === "boolean")
          setTtsEnabled(saved.ttsEnabled);
        if (typeof saved?.handsFree === "boolean")
          setHandsFree(saved.handsFree);
        if (MODES.some((option) => option.value === saved?.mode))
          setMode(saved.mode);
        if (findPersona(saved?.personaId)) setPersonaId(saved.personaId);
        if (saved?.continuous === true) {
          // Restored paused: the mic only opens when you tap to resume, so we
          // never start listening on page load.
          setContinuous(true);
          setLoopPaused(true);
        }
      }
    } catch (caught) {
      console.warn("[session] could not restore session", caught);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          turns,
          activeTurnId,
          level,
          topic,
          ttsEnabled,
          handsFree,
          mode,
          personaId,
          continuous,
        }),
      );
    } catch {
      /* storage full or blocked — non fatal */
    }
  }, [
    hydrated,
    turns,
    activeTurnId,
    level,
    topic,
    ttsEnabled,
    handsFree,
    mode,
    personaId,
    continuous,
  ]);

  // Mirrors of the loop flags so async callbacks always read the latest state.
  useEffect(() => {
    continuousRef.current = continuous;
  }, [continuous]);

  useEffect(() => {
    loopPausedRef.current = loopPaused;
  }, [loopPaused]);

  const stopSpeaking = useCallback(() => {
    speakAbortRef.current?.abort();
    speakAbortRef.current = null;
    stopPlayback();
    setIsSpeaking(false);
    setSpeakingLevel(0);
    setSpeakingText("");
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Text-to-speech (tts-1 via /api/tts, played through the Web Audio API)   */
  /* ---------------------------------------------------------------------- */
  const speak = useCallback(async (text) => {
    if (!text) return;

    const controller = new AbortController();
    speakAbortRef.current?.abort();
    speakAbortRef.current = controller;

    try {
      const unlocked = await primeAudioPlayback();
      if (!unlocked) {
        throw new Error(
          "Tap anywhere on the page once to allow audio playback, then try again.",
        );
      }

      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(
          payload?.error?.message ||
            "The spoken reply is unavailable right now.",
        );
      }

      const audio = await response.arrayBuffer();
      if (controller.signal.aborted) return;

      setIsSpeaking(true);
      setSpeakingText(text);
      await playAudioBuffer(audio, {
        // Drives the avatar's mouth from the real amplitude of the voice.
        onLevel: setSpeakingLevel,
        onEnded: () => {
          setIsSpeaking(false);
          setSpeakingLevel(0);
          // Continuous talk: straight back to listening once I stop talking.
          afterSpeakRef.current?.();
        },
      });
    } catch (caught) {
      if (caught?.name === "AbortError") return;
      console.error("[tts]", caught);
      setIsSpeaking(false);
      setSpeakingLevel(0);
      // Voice playback is a bonus: surface it as a dismissible warning only.
      setError(
        (current) =>
          current ?? {
            message: `Voice playback isn't available: ${caught?.message || "unknown error"}`,
            tone: "warning",
            canRetry: false,
          },
      );
    } finally {
      if (speakAbortRef.current === controller) speakAbortRef.current = null;
    }
  }, []);

  const clearListenTimer = useCallback(() => {
    if (listenTimerRef.current) {
      clearTimeout(listenTimerRef.current);
      listenTimerRef.current = null;
    }
  }, []);

  /**
   * Continuous talk: open the mic and wait. When you stop speaking, the
   * recorder's VAD fires `onSilence` and the turn is sent automatically.
   */
  const beginListening = useCallback(async () => {
    if (!continuousRef.current || loopPausedRef.current) return;

    clearListenTimer();
    heardSpeechRef.current = false;
    nudgedRef.current = false;

    await startRecorderRef.current?.();

    listenTimerRef.current = setTimeout(() => {
      if (!continuousRef.current || loopPausedRef.current) return;
      if (heardSpeechRef.current || nudgedRef.current) return;

      // Nobody said anything for a while: nudge once, then keep listening.
      nudgedRef.current = true;
      cancelRecorderRef.current?.();
      void speak(nudgeFor(speakerRef.current ?? COACH));
    }, LISTEN_NUDGE_MS);
  }, [clearListenTimer, speak]);

  /* ---------------------------------------------------------------------- */
  /* Main turn: blob -> /api/speak -> chat + feedback + spoken reply         */
  /* ---------------------------------------------------------------------- */
  const submitRecording = useCallback(
    async (blob, { durationMs } = {}) => {
      stopSpeaking();
      setError(null);

      const controller = new AbortController();
      requestAbortRef.current = controller;
      setIsProcessing(true);
      setPendingLabel("Transcribing your voice…");

      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = setTimeout(
        () => setPendingLabel("Coaching grammar & vocabulary…"),
        4_000,
      );

      const formData = new FormData();
      formData.append(
        "audio",
        blob,
        `turn-${Date.now()}.${extensionForMime(blob.type)}`,
      );
      formData.append("level", level);
      formData.append("topic", topic);
      formData.append("mode", mode);
      const persona = mode === "persona" ? findPersona(personaId) : null;
      if (persona) formData.append("persona", persona.id);
      formData.append("durationMs", String(Math.round(durationMs || 0)));
      formData.append("history", JSON.stringify(buildHistory(turns)));

      try {
        const response = await fetch("/api/speak", {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload?.transcript || !payload?.aiSpeech) {
          throw toClientError(payload, response.status);
        }

        const turn = {
          id: payload.id || newId(),
          transcript: payload.transcript,
          aiSpeech: payload.aiSpeech,
          feedback: payload.feedback ?? {},
          meta: payload.meta ?? null,
          createdAt: Date.now(),
          durationMs: payload.meta?.durationMs ?? durationMs ?? null,
        };

        setTurns((previous) => [...previous, turn].slice(-MAX_STORED_TURNS));
        setActiveTurnId(turn.id);
        retryRef.current = null;
        setMobileTab("feedback");

        if (ttsEnabled) {
          void speak(turn.aiSpeech);
        } else if (continuousRef.current && !loopPausedRef.current) {
          // No spoken reply to wait for — keep the loop alive.
          void beginListening();
        }
      } catch (caught) {
        if (caught?.name === "AbortError") return;

        console.error("[speak] request failed", caught);
        retryRef.current = { blob, durationMs };
        // Pause auto-talk so the message is readable instead of looping errors.
        if (continuousRef.current) {
          loopPausedRef.current = true;
          setLoopPaused(true);
        }
        setError({
          message:
            caught?.message ||
            "We couldn't process that recording. Please try again.",
          tone: "error",
          canRetry: true,
        });
      } finally {
        if (pendingTimerRef.current) {
          clearTimeout(pendingTimerRef.current);
          pendingTimerRef.current = null;
        }
        setPendingLabel(null);
        setIsProcessing(false);
        if (requestAbortRef.current === controller)
          requestAbortRef.current = null;
      }
    },
    [
      level,
      topic,
      turns,
      ttsEnabled,
      speak,
      stopSpeaking,
      mode,
      personaId,
      beginListening,
    ],
  );

  // Voice-activity detection is only armed in continuous mode; everywhere else
  // the user presses the mic.
  const vad = useMemo(
    () =>
      continuous
        ? {
            enabled: true,
            silenceMs: TURN_SILENCE_MS,
            threshold: SPEECH_THRESHOLD,
            onSpeech: () => {
              heardSpeechRef.current = true;
            },
            onSilence: () => {
              clearListenTimer();
              stopRecorderRef.current?.();
            },
            onDiscard: () => {
              beginListeningRef.current?.();
            },
          }
        : { enabled: false },
    [continuous, clearListenTimer],
  );

  const recorder = useVoiceRecorder({
    maxDurationMs: MAX_RECORDING_MS,
    onComplete: submitRecording,
    vad,
  });

  const {
    status: recorderStatus,
    elapsedMs,
    level: micLevel,
    error: recorderError,
    isSupported,
    start: startRecording,
    stop: stopRecording,
    cancel: cancelRecording,
    clearError: clearRecorderError,
  } = recorder;

  // Expose the recorder controls + the loop kickoff to callbacks that were
  // defined before the hook ran (VAD, audio-ended, nudge timer).
  useEffect(() => {
    startRecorderRef.current = startRecording;
    stopRecorderRef.current = stopRecording;
    cancelRecorderRef.current = cancelRecording;
  }, [startRecording, stopRecording, cancelRecording]);

  useEffect(() => {
    beginListeningRef.current = beginListening;
    afterSpeakRef.current = () => {
      if (continuousRef.current && !loopPausedRef.current)
        void beginListening();
    };
  }, [beginListening]);

  /* ---------------------------------------------------------------------- */
  /* Side effects                                                           */
  /* ---------------------------------------------------------------------- */
  // If the user released the mic before permission was granted, cancel the
  // take as soon as the recorder actually starts.
  useEffect(() => {
    if (cancelOnStartRef.current && recorderStatus === "recording") {
      cancelOnStartRef.current = false;
      cancelRecording();
    }
  }, [recorderStatus, cancelRecording]);

  // Abort every in-flight request when the page unmounts.
  useEffect(() => {
    return () => {
      requestAbortRef.current?.abort();
      speakAbortRef.current?.abort();
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      if (listenTimerRef.current) clearTimeout(listenTimerRef.current);
      stopPlayback();
    };
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Handlers                                                               */
  /* ---------------------------------------------------------------------- */
  const handleStart = useCallback(async () => {
    setError(null);
    cancelOnStartRef.current = false;
    pressActiveRef.current = true;
    retryRef.current = null;
    stopSpeaking();

    // Resume the AudioContext while we still have a user gesture, so the TTS
    // reply can autoplay later in the async flow.
    await primeAudioPlayback();
    await startRecording();

    // The pointer may have been released while we were awaiting permission or
    // the audio context — in that case the take is aborted instead of hanging.
    if (!pressActiveRef.current) cancelRecording();
  }, [cancelRecording, startRecording, stopSpeaking]);

  const handleStop = useCallback(() => {
    pressActiveRef.current = false;

    if (recorderStatus === "recording") {
      stopRecording();
      return;
    }
    if (recorderStatus === "requesting") {
      cancelOnStartRef.current = true;
    }
  }, [recorderStatus, stopRecording]);

  const handleRetry = useCallback(() => {
    const pending = retryRef.current;
    if (!pending) return;
    setError(null);
    void submitRecording(pending.blob, { durationMs: pending.durationMs });
  }, [submitRecording]);

  const handlePlayReply = useCallback(
    (turn) => {
      if (isSpeaking) {
        stopSpeaking();
        return;
      }
      void speak(turn.aiSpeech);
    },
    [isSpeaking, speak, stopSpeaking],
  );

  const handleToggleTts = useCallback(() => {
    if (ttsEnabled) stopSpeaking();
    setTtsEnabled(!ttsEnabled);
  }, [ttsEnabled, stopSpeaking]);

  /** Switching mode/person changes who is talking: stop the current voice. */
  const handleModeChange = useCallback(
    (nextMode) => {
      if (nextMode === mode) return;
      stopSpeaking();
      setMode(nextMode);
      setMobileTab("chat");
    },
    [mode, stopSpeaking],
  );

  const handlePersonaChange = useCallback(
    (nextPersonaId) => {
      if (nextPersonaId === personaId || !findPersona(nextPersonaId)) return;
      stopSpeaking();
      setPersonaId(nextPersonaId);
    },
    [personaId, stopSpeaking],
  );

  /* ---------------------------------------------------------------------- */
  /* Continuous talk controls                                               */
  /* ---------------------------------------------------------------------- */

  /** Pause the loop: stop listening and stop the voice. */
  const handleLoopPause = useCallback(() => {
    loopPausedRef.current = true;
    setLoopPaused(true);
    clearListenTimer();
    cancelRecording();
    stopSpeaking();
  }, [cancelRecording, clearListenTimer, stopSpeaking]);

  /** Resume the loop: open the mic again. */
  const handleLoopResume = useCallback(() => {
    loopPausedRef.current = false;
    setLoopPaused(false);
    void beginListening();
  }, [beginListening]);

  const handleToggleContinuous = useCallback(() => {
    if (continuous) {
      continuousRef.current = false;
      loopPausedRef.current = false;
      setContinuous(false);
      setLoopPaused(false);
      clearListenTimer();
      cancelRecording();
      stopSpeaking();
      return;
    }

    // The loop only makes sense with a voice.
    if (!ttsEnabled) setTtsEnabled(true);

    continuousRef.current = true;
    loopPausedRef.current = false;
    setContinuous(true);
    setLoopPaused(false);
    setError(null);

    if (turns.length === 0) {
      // Open the conversation in character, then start listening.
      void speak(greetingFor(speakerRef.current ?? COACH));
    } else {
      void beginListening();
    }
  }, [
    continuous,
    ttsEnabled,
    turns.length,
    speak,
    beginListening,
    cancelRecording,
    clearListenTimer,
    stopSpeaking,
  ]);

  const handleSelectTurn = useCallback((turnId) => {
    setActiveTurnId(turnId);
    setMobileTab("feedback");
  }, []);

  const handleNewSession = useCallback(() => {
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
    clearListenTimer();
    stopSpeaking();
    cancelRecording();
    setIsProcessing(false);
    setPendingLabel(null);
    setTurns([]);
    setActiveTurnId(null);
    setError(null);
    retryRef.current = null;
    setMobileTab("chat");
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }

    // In continuous mode, restart the conversation with a fresh greeting.
    if (continuousRef.current && !loopPausedRef.current) {
      void speak(greetingFor(speakerRef.current ?? COACH));
    }
  }, [cancelRecording, clearListenTimer, speak, stopSpeaking]);

  const handleDismissError = useCallback(() => {
    setError(null);
    clearRecorderError();
  }, [clearRecorderError]);

  /* ---------------------------------------------------------------------- */
  /* Derived values                                                         */
  /* ---------------------------------------------------------------------- */
  const activeTurn = useMemo(() => {
    if (!turns.length) return null;
    return (
      turns.find((turn) => turn.id === activeTurnId) ?? turns[turns.length - 1]
    );
  }, [turns, activeTurnId]);

  const activePersona = useMemo(
    () => findPersona(personaId) || PERSONAS[0],
    [personaId],
  );

  /** Who the learner is currently talking to (drives names, avatars, colours). */
  const speaker = useMemo(
    () =>
      mode === "persona"
        ? {
            name: activePersona.name,
            role: activePersona.tagline,
            avatarClass: activePersona.avatarClass,
            textTone: activePersona.textTone,
            palette: activePersona.palette,
          }
        : {
            name: COACH.name,
            role: COACH.role,
            avatarClass: COACH.avatarClass,
            textTone: COACH.textTone,
            palette: COACH.palette,
          },
    [mode, activePersona],
  );

  useEffect(() => {
    speakerRef.current = speaker;
  }, [speaker]);

  const displayError =
    error ??
    (recorderError
      ? { message: recorderError, tone: "error", canRetry: false }
      : null);

  const micState = useMemo(() => {
    if (continuous && isSpeaking) return "speaking";
    if (isProcessing || recorderStatus === "stopping") return "processing";
    if (recorderStatus === "requesting") return "requesting";
    if (recorderStatus === "recording") return "recording";
    return "idle";
  }, [continuous, isSpeaking, isProcessing, recorderStatus]);

  const statusText = {
    requesting: "Microphone permission",
    recording: continuous ? "Listening to you" : "Recording",
    speaking: "Speaking",
    processing: "Processing",
    idle: continuous ? (loopPaused ? "Paused" : "Ready") : "Ready",
  }[micState];

  let detailText;
  if (continuous) {
    detailText = loopPaused
      ? "Continuous talk is paused. Tap the mic to jump back into the conversation."
      : micState === "speaking"
        ? "I'll start listening again the moment I finish this sentence."
        : "Continuous talk is on — just speak and pause. I'll send it and answer by myself.";
  } else if (micState === "recording") {
    detailText = handsFree
      ? "Tap the mic again to stop and send your turn."
      : "Release the mic to send. Speak naturally — mistakes are how we learn.";
  } else if (micState === "processing") {
    detailText =
      "Whisper is transcribing your voice, then GPT-4o writes the reply and grades this turn.";
  } else if (micState === "requesting") {
    detailText =
      "Your browser is asking for microphone access. Allow it to start practising.";
  } else if (turns.length) {
    detailText =
      mode === "persona"
        ? `Ask ${speaker.name} anything — they answer and ask you questions back.`
        : "Ask a follow-up question, or switch topic and level for a new challenge.";
  } else {
    detailText =
      mode === "persona"
        ? `Hold the mic and say hello to ${speaker.name}. They'll answer your questions and ask their own.`
        : "Hold the mic and introduce yourself. Ava replies out loud and coaches every turn.";
  }

  /* What the virtual person is doing right now (drives the avatar stage). */
  const stageState = isSpeaking
    ? "speaking"
    : micState === "recording"
      ? "listening"
      : micState === "processing"
        ? "thinking"
        : "idle";

  const stageCaption = isSpeaking
    ? speakingText
    : stageState === "listening"
      ? "I'm listening — take your time and speak naturally."
      : stageState === "thinking"
        ? "Let me think about what you said…"
        : `${speaker.name} is ready. Hold the mic and start talking.`;

  /* Mic button semantics: manual hold/tap, or the continuous-loop control. */
  const micMode = continuous || handsFree ? "toggle" : "hold";
  const micOnStart = continuous ? handleLoopResume : handleStart;
  const micOnStop = continuous ? handleLoopPause : handleStop;
  const micDisabled = continuous ? false : micState === "processing";
  const micHint = continuous
    ? loopPaused
      ? "Tap to resume the conversation"
      : micState === "speaking"
        ? "Tap to pause while I'm talking"
        : "Continuous talk — just speak, I'll send it when you pause"
    : undefined;

  const tabs = [
    {
      id: "chat",
      label: "Conversation",
      icon: <MessageIcon className="h-3.5 w-3.5" />,
    },
    {
      id: "feedback",
      label: "Feedback",
      icon: <SparklesIcon className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <div className="relative flex min-h-dvh flex-col">
      {/* Ambient background */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -top-48 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-sky-500/10 blur-[120px]" />
        <div className="absolute -bottom-40 -right-32 h-[30rem] w-[30rem] rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.08),_transparent_55%)]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col gap-3 px-3 py-3 sm:gap-4 sm:px-6 sm:py-4 lg:h-dvh lg:overflow-hidden">
        <TopBar
          level={level}
          topic={topic}
          mode={mode}
          personaId={personaId}
          onLevelChange={setLevel}
          onTopicChange={setTopic}
          onModeChange={handleModeChange}
          onPersonaChange={handlePersonaChange}
          ttsEnabled={ttsEnabled}
          onToggleTts={handleToggleTts}
          onNewSession={handleNewSession}
          isSpeaking={isSpeaking}
          canReset={turns.length > 0}
          disabled={isProcessing}
        />

        {/* Mobile panel switcher */}
        <div
          className="flex gap-1 rounded-2xl border border-white/10 bg-slate-900/60 p-1 lg:hidden"
          role="tablist"
          aria-label="Panels"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={mobileTab === tab.id}
              onClick={() => setMobileTab(tab.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition",
                mobileTab === tab.id
                  ? "bg-white/10 text-slate-100"
                  : "text-slate-400 hover:text-slate-200",
              )}
            >
              {tab.icon}
              {tab.label}
              {tab.id === "feedback" && isProcessing && (
                <span
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400"
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
        </div>

        <main className="grid min-h-0 flex-1 gap-3 sm:gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <ChatPanel
            className={cn(mobileTab === "chat" ? "flex" : "hidden lg:flex")}
            turns={turns}
            activeTurnId={activeTurn?.id ?? null}
            isPending={isProcessing}
            pendingLabel={pendingLabel}
            isSpeaking={isSpeaking}
            speaker={speaker}
            avatarState={stageState}
            avatarLevel={speakingLevel}
            caption={stageCaption}
            onSelectTurn={handleSelectTurn}
            onPlayReply={handlePlayReply}
            onClear={handleNewSession}
          />

          <FeedbackPanel
            className={cn(mobileTab === "feedback" ? "flex" : "hidden lg:flex")}
            turn={activeTurn}
            isLoading={isProcessing}
          />
        </main>

        <RecorderDock
          micState={micState}
          elapsedMs={elapsedMs}
          maxMs={MAX_RECORDING_MS}
          level={micLevel}
          continuous={continuous}
          onToggleContinuous={handleToggleContinuous}
          micMode={micMode}
          micHint={micHint}
          micDisabled={micDisabled}
          onMicStart={micOnStart}
          onMicStop={micOnStop}
          handsFree={handsFree}
          onToggleHandsFree={() => setHandsFree((value) => !value)}
          ttsEnabled={ttsEnabled}
          onToggleTts={handleToggleTts}
          isSpeaking={isSpeaking}
          onStopSpeaking={stopSpeaking}
          onStart={handleStart}
          onStop={handleStop}
          error={displayError}
          onDismissError={handleDismissError}
          onRetry={handleRetry}
          isSupported={isSupported}
          statusText={statusText}
          detailText={detailText}
        />

        <p className="pb-1 text-center text-[10px] leading-relaxed text-slate-600">
          Audio is sent to OpenAI for transcription (Whisper) and coaching
          (GPT-4o). This app stores only the text, in your browser.
        </p>
      </div>
    </div>
  );
}
