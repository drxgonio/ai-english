/**
 * Values shared by the browser and the route handlers.
 * Keep this file free of Node/browser-only APIs.
 */

export const CEFR_LEVELS = [
  { value: "A2", label: "A2 · Elementary", hint: "Short, everyday sentences" },
  {
    value: "B1",
    label: "B1 · Intermediate",
    hint: "Connect ideas, handle daily topics",
  },
  {
    value: "B2",
    label: "B2 · Upper-intermediate",
    hint: "Discuss opinions with detail",
  },
  {
    value: "C1",
    label: "C1 · Advanced",
    hint: "Precise, flexible, near-natural",
  },
];

export const LEVEL_VALUES = CEFR_LEVELS.map((level) => level.value);
export const DEFAULT_LEVEL = "B1";

export const TOPICS = [
  "Free talk",
  "Job interview",
  "Travel & airports",
  "Business meetings",
  "Daily life",
  "Technology & AI",
  "Food & restaurants",
  "Health & fitness",
];

export const DEFAULT_TOPIC = TOPICS[0];

/* -------------------------------------------------------------------------- */
/* Conversation modes                                                         */
/* -------------------------------------------------------------------------- */

/**
 * "coach"  — Ava, the English coach: keeps the conversation going and grades you.
 * "persona" — a virtual person you simply *talk* to: they answer your questions
 *             and ask their own, like chatting with a real human being.
 */
export const MODES = [
  {
    value: "coach",
    label: "Coach",
    hint: "Guided practice with corrections after every turn",
  },
  {
    value: "persona",
    label: "Virtual person",
    hint: "Chat with a virtual person who answers and asks questions",
  },
];

export const DEFAULT_MODE = "coach";

/**
 * The virtual people available in "persona" mode. `prompt` is merged into the
 * system prompt, so each character has their own voice, background and way of
 * asking questions. Tailwind classes are intentionally complete strings so the
 * compiler can see them.
 */
export const PERSONAS = [
  {
    id: "mia",
    name: "Mia",
    tagline: "Student · travel buddy",
    prompt:
      "You are Mia, 24, an exchange student from Madrid who is studying abroad and loves travelling, food and music. The learner met you at a language-exchange evening at a cosy café, and you are chatting like new friends. You are warm, curious and a little playful, you laugh easily, and you genuinely want to hear about the learner's life. You never sound like a teacher.",
    textTone: "text-rose-300",
    avatarClass: "from-rose-400 to-orange-400",
    palette: ["#fb7185", "#fb923c"],
  },
  {
    id: "leo",
    name: "Leo",
    tagline: "Engineer · startup founder",
    prompt:
      "You are Leo, 30, a software engineer who recently started a small company. You are relaxed, practical and curious about people. You enjoy talking about work, technology, food and everyday plans, and you happily answer any question the learner asks you. You have opinions, but you are never pushy.",
    textTone: "text-sky-300",
    avatarClass: "from-sky-400 to-indigo-400",
    palette: ["#38bdf8", "#818cf8"],
  },
  {
    id: "sofia",
    name: "Sofia",
    tagline: "Journalist · artist",
    prompt:
      "You are Sofia, 35, a journalist and painter. You are thoughtful, articulate and a great listener. You ask interesting open questions, share your own views and gently invite the learner to explain their ideas in more depth. Your English is fluent and calm, and you never lecture.",
    textTone: "text-emerald-300",
    avatarClass: "from-emerald-400 to-teal-400",
    palette: ["#34d399", "#2dd4bf"],
  },
  {
    id: "daniel",
    name: "Daniel",
    tagline: "Local guide · barista",
    prompt:
      "You are Daniel, 28, a cheerful barista and part-time city guide. You love recommending cafés, food and places to visit, and you are always happy to hear about the learner's day and plans. You speak simply and warmly, using short sentences and friendly questions.",
    textTone: "text-amber-300",
    avatarClass: "from-amber-400 to-yellow-400",
    palette: ["#fbbf24", "#facc15"],
  },
];

export const DEFAULT_PERSONA_ID = PERSONAS[0].id;

/** Looks up a persona by id (returns null for anything unknown). */
export function findPersona(id) {
  return PERSONAS.find((persona) => persona.id === id) || null;
}

export const COACH = {
  name: "Ava",
  role: "AI coach",
  tagline: "English coach",
  textTone: "text-indigo-300",
  avatarClass: "from-indigo-400 to-violet-400",
  palette: ["#818cf8", "#a78bfa"],
};

/** Hard cap enforced by the recorder and by the API (Whisper accepts 25 MB). */
export const MAX_RECORDING_MS = 60_000;
/** Show a "wrap up" warning near the limit. */
export const WARN_RECORDING_MS = 50_000;
/** Below this length we assume an accidental tap and do not call the API. */
export const MIN_RECORDING_MS = 700;
/** Reject uploads above 20 MB before they reach OpenAI. */
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
/** How many turns we keep in the client session + send as context. */
export const MAX_STORED_TURNS = 24;
export const MAX_CONTEXT_TURNS = 6;
/** Max characters accepted by /api/tts. */
export const MAX_TTS_CHARS = 600;

export const STORAGE_KEY = "speakflow:session:v2";
