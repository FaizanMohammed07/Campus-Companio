/**
 * tts.ts — Unified Text-to-Speech utility for Campus Companion.
 *
 * Priority chain:
 *   1. ElevenLabs (via /api/tts/speak backend proxy)
 *   2. window.speechSynthesis (browser fallback)
 *   3. Silent no-op (no crash)
 *
 * Every component should import { speak, stopSpeaking } from here.
 * Speech-to-text (mic recognition) is NOT affected — only TTS output.
 */

// ── Internal state ──

let currentAudioCtx: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;
let ttsAvailable: "elevenlabs" | "fallback" | "unknown" = "unknown";

/**
 * Check ElevenLabs availability by calling GET /api/tts/voices.
 * Updates internal `ttsAvailable` state and returns the mode.
 */
export async function checkTtsAvailability(): Promise<
  "elevenlabs" | "fallback"
> {
  try {
    const res = await fetch("/api/tts/voices", {
      signal: AbortSignal.timeout(5_000),
    });
    if (res.ok) {
      ttsAvailable = "elevenlabs";
      return "elevenlabs";
    }
  } catch {
    // network error or timeout
  }
  ttsAvailable = "fallback";
  return "fallback";
}

/** Returns last-known TTS mode. Call checkTtsAvailability() first. */
export function getTtsMode(): "elevenlabs" | "fallback" | "unknown" {
  return ttsAvailable;
}

// ── ElevenLabs path ──

async function speakWithElevenLabs(text: string): Promise<void> {
  const res = await fetch("/api/tts/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  // If backend says fallback needed, throw so caller can switch
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (body.fallback) {
      throw new Error("ELEVENLABS_FALLBACK");
    }
    throw new Error(`TTS backend error ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("audio")) {
    throw new Error("TTS response was not audio");
  }

  const arrayBuffer = await res.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    throw new Error("TTS returned empty audio");
  }

  // Decode & play via Web Audio API
  const audioCtx = new AudioContext();
  currentAudioCtx = audioCtx;

  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  return new Promise<void>((resolve, reject) => {
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtx.destination);
    currentSource = source;

    source.onended = () => {
      currentSource = null;
      currentAudioCtx = null;
      audioCtx.close().catch(() => {});
      resolve();
    };

    source.start(0);
  });
}

// ── Browser fallback path ──

async function speakWithFallback(
  text: string,
  lang?: "english" | "telugu",
): Promise<void> {
  return new Promise<void>((resolve) => {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window)
    ) {
      resolve(); // silent no-op
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();

    if (lang === "telugu") {
      const teluguVoice = voices.find(
        (v) => v.lang === "te-IN" || v.lang.startsWith("te"),
      );
      if (teluguVoice) utterance.voice = teluguVoice;
    } else {
      const preferred = voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Google") ||
            v.name.includes("Samantha") ||
            v.name.includes("Daniel")),
      );
      if (preferred) utterance.voice = preferred;
    }

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve(); // resolve, don't crash

    window.speechSynthesis.speak(utterance);
  });
}

// ── Public API ──

/**
 * Speak text using ElevenLabs AI voice, with automatic fallback
 * to browser speechSynthesis if ElevenLabs is unavailable.
 *
 * For Telugu, always falls back to browser voice since ElevenLabs
 * does not support Telugu well.
 */
export async function speak(
  text: string,
  options?: { lang?: "english" | "telugu" },
): Promise<void> {
  if (!text) return;

  // Telugu → always use browser fallback (ElevenLabs doesn't support Telugu)
  if (options?.lang === "telugu") {
    return speakWithFallback(text, "telugu");
  }

  // English → try ElevenLabs first
  try {
    await speakWithElevenLabs(text);
    // Update availability status on success
    if (ttsAvailable !== "elevenlabs") ttsAvailable = "elevenlabs";
  } catch (err) {
    console.warn("[TTS] ElevenLabs failed, falling back to browser voice:", err);
    if (ttsAvailable !== "fallback") ttsAvailable = "fallback";
    await speakWithFallback(text, "english");
  }
}

/**
 * Stop any currently playing TTS audio — ElevenLabs or browser.
 */
export function stopSpeaking(): void {
  // Stop ElevenLabs audio
  try {
    if (currentSource) {
      currentSource.stop();
      currentSource.disconnect();
      currentSource = null;
    }
    if (currentAudioCtx) {
      currentAudioCtx.close().catch(() => {});
      currentAudioCtx = null;
    }
  } catch {
    // ignore
  }

  // Also stop browser speechSynthesis (may be playing as fallback, or from other callers)
  try {
    window.speechSynthesis?.cancel();
  } catch {
    // ignore
  }
}
