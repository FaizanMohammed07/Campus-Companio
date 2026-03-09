import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Volume2,
  Users,
  Hand,
  Coffee,
  Heart,
  ChevronRight,
  Square,
  Loader2,
  AlertTriangle,
  Send,
  X,
} from "lucide-react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { speak, stopSpeaking, checkTtsAvailability } from "@/lib/tts";

// ── Types ──

interface Guest {
  id: string;
  name: string;
  title: string;
  description: string;
  order: number;
  announced: boolean;
  script: string | null;
}

interface EventData {
  name: string;
  venue: string;
  date: string;
  description: string;
  active: boolean;
}

type CrowdAction = "applause" | "seated" | "break" | "welcome" | "thankyou";
type Language = "english" | "telugu";

// ── Applause Sound Generator (Web Audio API) ──

function playApplauseSound(): Promise<void> {
  return new Promise((resolve) => {
    const ctx = new AudioContext();
    const duration = 2.5;
    const sampleRate = ctx.sampleRate;
    const bufferSize = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    // Fill with white noise
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Bandpass filter — makes it sound like crowd clapping
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1000;
    filter.Q.value = 0.5;

    // Amplitude envelope: attack 0.1s, sustain 1.5s, release 0.9s
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.1);
    gain.gain.setValueAtTime(0.35, now + 1.6);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start(now);
    source.stop(now + duration);

    source.onended = () => {
      ctx.close();
      resolve();
    };
  });
}

// ── Component ──

export default function HostMode() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Core state
  const [event, setEvent] = useState<EventData | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [activeGuestId, setActiveGuestId] = useState<string | null>(null);
  const [currentScript, setCurrentScript] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showRunsheet, setShowRunsheet] = useState(false);

  // Countdown state (Improvement 2)
  const [countingDown, setCountingDown] = useState(false);
  const [countdownValue, setCountdownValue] = useState(3);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingGuestIdRef = useRef<string | null>(null);

  // Fullscreen announcement card (Improvement 3)
  const [announcing, setAnnouncing] = useState(false);

  // Elapsed speaker timer (Improvement 6)
  const [speakerStartTime, setSpeakerStartTime] = useState<number | null>(null);
  const [elapsedDisplay, setElapsedDisplay] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Multilingual (Improvement 11)
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("english");
  const [scriptTelugu, setScriptTelugu] = useState<string | null>(null);
  const [hasTeluguVoice, setHasTeluguVoice] = useState(true);

  // Emergency announcement (Improvement 8)
  const [showEmergencyInput, setShowEmergencyInput] = useState(false);
  const [emergencyText, setEmergencyText] = useState("");

  // TTS mode tracking (ElevenLabs vs fallback)
  const [ttsMode, setTtsMode] = useState<"elevenlabs" | "fallback" | "unknown">("unknown");

  // Voices loaded
  const voicesLoaded = useRef(false);

  // Load voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis?.getVoices() ?? [];
      voicesLoaded.current = true;
      const teluguVoice = voices.find(
        (v) => v.lang === "te-IN" || v.lang.startsWith("te"),
      );
      setHasTeluguVoice(!!teluguVoice);
    };
    loadVoices();
    window.speechSynthesis?.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis?.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  // Check ElevenLabs availability on mount
  useEffect(() => {
    checkTtsAvailability().then((mode) => setTtsMode(mode));
  }, []);

  // Cleanup intervals + stop TTS on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      stopSpeaking();
    };
  }, []);

  // Elapsed timer tick
  useEffect(() => {
    if (speakerStartTime) {
      timerRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - speakerStartTime) / 1000);
        const mins = Math.floor(secs / 60);
        const remSecs = secs % 60;
        setElapsedDisplay(
          `${String(mins).padStart(2, "0")}:${String(remSecs).padStart(2, "0")}`,
        );
      }, 1000);
    } else {
      setElapsedDisplay("");
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [speakerStartTime]);

  // Escape key closes emergency input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showEmergencyInput) {
        setShowEmergencyInput(false);
        setEmergencyText("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showEmergencyInput]);

  // ── Load runsheet ──
  const loadRunsheet = useCallback(async () => {
    try {
      const res = await fetch("/api/host/runsheet");
      const json = await res.json();
      if (json.ok && json.data) {
        setEvent(json.data.event);
        setGuests(json.data.guests || []);
      }
    } catch (e) {
      console.error("[HostMode] Failed to load runsheet:", e);
    }
  }, []);

  useEffect(() => {
    loadRunsheet();
  }, [loadRunsheet]);

  // ── Current guest index ──
  const currentGuestIndex = guests.findIndex((g) => g.id === activeGuestId);
  const activeGuest = currentGuestIndex >= 0 ? guests[currentGuestIndex] : null;
  const nextGuest =
    currentGuestIndex >= 0 && currentGuestIndex + 1 < guests.length
      ? guests[currentGuestIndex + 1]
      : null;

  // ── Get first unannounced guest (for the big announce button) ──
  const firstUnannounced = guests.find((g) => !g.announced);

  // ── Start countdown then announce ──
  const startCountdownAndAnnounce = (guestId: string) => {
    pendingGuestIdRef.current = guestId;
    setCountingDown(true);
    setCountdownValue(3);

    let count = 3;
    countdownRef.current = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = null;
        setCountingDown(false);
        // Now actually announce
        if (pendingGuestIdRef.current) {
          handleAnnounce(pendingGuestIdRef.current);
          pendingGuestIdRef.current = null;
        }
      } else {
        setCountdownValue(count);
      }
    }, 1000);
  };

  // ── Announce guest (actual API call + TTS) ──
  const handleAnnounce = async (guestId: string) => {
    setIsGenerating(true);
    setActiveGuestId(guestId);
    setCurrentScript(null);
    setScriptTelugu(null);
    setSpeakerStartTime(null);

    try {
      const res = await fetch(`/api/host/announce/${guestId}`, {
        method: "POST",
      });
      const json = await res.json();

      if (json.ok && json.data?.script) {
        const script: string = json.data.script;
        const telugu: string | null = json.data.scriptTelugu ?? null;
        setCurrentScript(script);
        setScriptTelugu(telugu);

        // Pick text based on selected language
        const textToSpeak =
          selectedLanguage === "telugu" && telugu ? telugu : script;

        // Show fullscreen announcement card + start speaking
        setAnnouncing(true);
        setIsSpeaking(true);
        try {
          await speak(textToSpeak, {
            lang: selectedLanguage === "telugu" && telugu ? "telugu" : "english",
          });
        } catch (e) {
          console.error("[HostMode] TTS error:", e);
        }

        // TTS finished — play applause
        setIsSpeaking(false);
        try {
          await playApplauseSound();
        } catch (e) {
          console.error("[HostMode] Applause error:", e);
        }

        // Applause done — hide overlay, start elapsed timer
        setAnnouncing(false);
        setSpeakerStartTime(Date.now());

        // Refresh runsheet to update announced status
        await loadRunsheet();
      } else {
        toast({
          title: "Error",
          description: json.error?.message || "Failed to generate announcement",
          variant: "destructive",
        });
      }
    } catch (e) {
      console.error("[HostMode] Announce error:", e);
      toast({
        title: "Network error",
        description: "Could not reach the server.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Speak current script again ──
  const handleSpeak = async () => {
    if (!currentScript) return;
    const textToSpeak =
      selectedLanguage === "telugu" && scriptTelugu ? scriptTelugu : currentScript;
    setIsSpeaking(true);
    try {
      await speak(textToSpeak, {
        lang: selectedLanguage === "telugu" && scriptTelugu ? "telugu" : "english",
      });
    } catch (e) {
      console.error("[HostMode] TTS error:", e);
    } finally {
      setIsSpeaking(false);
    }
  };

  // ── Crowd prompt ──
  const handleCrowdPrompt = async (action: CrowdAction) => {
    try {
      const res = await fetch(`/api/host/crowd/${action}`, {
        method: "POST",
      });
      const json = await res.json();

      if (json.ok && json.data?.script) {
        const script: string = json.data.script;
        setCurrentScript(script);
        setScriptTelugu(null);
        setActiveGuestId(null);

        setIsSpeaking(true);
        try {
          await speak(script);
        } catch (e) {
          console.error("[HostMode] TTS error:", e);
        } finally {
          setIsSpeaking(false);
        }
      }
    } catch (e) {
      console.error("[HostMode] Crowd prompt error:", e);
    }
  };

  // ── Emergency speak ──
  const handleEmergencySpeak = async () => {
    if (!emergencyText.trim()) return;
    const text = emergencyText.trim();
    setShowEmergencyInput(false);
    setEmergencyText("");

    setIsSpeaking(true);
    try {
      await speak(text);
    } catch (e) {
      console.error("[HostMode] Emergency TTS error:", e);
    } finally {
      setIsSpeaking(false);
    }
  };

  // ── Stop host mode ──
  const handleStopHostMode = async () => {
    stopSpeaking();
    if (countdownRef.current) clearInterval(countdownRef.current);
    setSpeakerStartTime(null);
    try {
      await fetch("/api/host/mode/stop", { method: "POST" });
    } catch (e) {
      console.error("[HostMode] Stop mode error:", e);
    }
    setLocation("/event-setup");
  };

  // ── Crowd prompt buttons ──
  const crowdButtons: {
    action: CrowdAction;
    icon: React.ReactNode;
    label: string;
    color: string;
  }[] = [
    {
      action: "welcome",
      icon: <Heart className="w-4 h-4" />,
      label: "Welcome",
      color: "bg-blue-500 hover:bg-blue-600",
    },
    {
      action: "applause",
      icon: <Hand className="w-4 h-4" />,
      label: "Applause",
      color: "bg-amber-500 hover:bg-amber-600",
    },
    {
      action: "seated",
      icon: <Users className="w-4 h-4" />,
      label: "Be Seated",
      color: "bg-teal-500 hover:bg-teal-600",
    },
    {
      action: "break",
      icon: <Coffee className="w-4 h-4" />,
      label: "Break",
      color: "bg-orange-500 hover:bg-orange-600",
    },
    {
      action: "thankyou",
      icon: <Heart className="w-4 h-4" />,
      label: "Thank You",
      color: "bg-rose-500 hover:bg-rose-600",
    },
  ];

  // ── Display script text based on selected language ──
  const displayScript =
    selectedLanguage === "telugu" && scriptTelugu ? scriptTelugu : currentScript;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white p-4 max-w-lg mx-auto flex flex-col relative">
      {/* ── Countdown Overlay (Improvement 2) ── */}
      <AnimatePresence>
        {countingDown && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center"
          >
            <AnimatePresence mode="wait">
              <motion.span
                key={countdownValue}
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 2, opacity: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="text-9xl font-black text-white drop-shadow-2xl"
              >
                {countdownValue}
              </motion.span>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Fullscreen Announcement Card (Improvement 3) ── */}
      <AnimatePresence>
        {announcing && activeGuest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-50 bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 flex flex-col items-center justify-center p-8"
          >
            {/* Animated glow ring */}
            <motion.div
              animate={{
                boxShadow: [
                  "0 0 20px rgba(139,92,246,0.3)",
                  "0 0 60px rgba(139,92,246,0.6)",
                  "0 0 20px rgba(139,92,246,0.3)",
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="rounded-full p-1 mb-8"
            >
              <div className="w-40 h-40 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-7xl shadow-2xl">
                🤖
              </div>
            </motion.div>

            {/* Guest name */}
            <motion.h1
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-5xl md:text-6xl font-black text-white text-center mb-3"
            >
              {activeGuest.name}
            </motion.h1>

            {/* Role/title */}
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-2xl text-indigo-300 font-medium text-center mb-4"
            >
              {activeGuest.title}
            </motion.p>

            {/* Description badge */}
            {activeGuest.description && (
              <motion.span
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="px-4 py-2 rounded-full bg-white/10 text-white/70 text-lg mb-8"
              >
                {activeGuest.description}
              </motion.span>
            )}

            {/* Animated waveform bars */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="flex items-end gap-1 mt-auto"
            >
              {Array.from({ length: 20 }).map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    height: [8, 16 + Math.random() * 24, 8],
                  }}
                  transition={{
                    duration: 0.4 + Math.random() * 0.4,
                    repeat: Infinity,
                    repeatType: "reverse",
                    delay: i * 0.05,
                  }}
                  className="w-1.5 rounded-full bg-gradient-to-t from-violet-500 to-fuchsia-400"
                />
              ))}
            </motion.div>
            <p className="text-white/50 text-sm mt-3">GUIDO is speaking…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-10 w-10 text-white/70 hover:text-white hover:bg-white/10"
            onClick={handleStopHostMode}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">🎤 Host Mode</h1>
            {event && <p className="text-sm text-white/60">{event.name}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Elapsed speaker timer badge (Improvement 6) */}
          {speakerStartTime && activeGuest && (
            <motion.span
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-xs bg-white/10 text-white/80 px-2 py-1 rounded-full font-mono"
            >
              🎙 {activeGuest.name.split(" ")[0]} — {elapsedDisplay}
            </motion.span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-white/60 hover:text-white hover:bg-white/10 text-xs"
            onClick={() => setShowRunsheet(!showRunsheet)}
          >
            📋 {showRunsheet ? "Hide" : "Runsheet"}
          </Button>
          <div
            className={`w-2 h-2 rounded-full ${isSpeaking ? "bg-green-400 animate-pulse" : "bg-white/30"}`}
          />
        </div>
      </div>

      {/* ── TTS Mode Badge ── */}
      {ttsMode === "fallback" && (
        <div className="mb-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2">
          <span className="text-xs text-amber-400">
            ⚠️ Using device voice — ElevenLabs unavailable
          </span>
        </div>
      )}

      {/* ── Speaking Indicator + Stop ── */}
      <AnimatePresence>
        {isSpeaking && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center justify-between overflow-hidden"
          >
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-green-400"
              />
              <span className="text-sm text-green-300 font-medium">
                🎙️ GUIDO is speaking…
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
              onClick={() => {
                stopSpeaking();
                setIsSpeaking(false);
              }}
            >
              <Square className="w-3 h-3 mr-1" />
              Stop
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Runsheet Sidebar ── */}
      <AnimatePresence>
        {showRunsheet && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 space-y-2 max-h-48 overflow-y-auto">
              {guests.map((guest, idx) => (
                <div
                  key={guest.id}
                  className={`flex items-center gap-2 p-2 rounded-xl text-sm ${
                    guest.id === activeGuestId
                      ? "bg-primary/20 border border-primary/40"
                      : guest.announced
                        ? "bg-green-500/10 text-green-300"
                        : "bg-white/5"
                  }`}
                >
                  <span className="text-xs font-mono w-5 text-center text-white/40">
                    {idx + 1}
                  </span>
                  <span className="flex-1 truncate">{guest.name}</span>
                  {guest.announced && <span className="text-xs">✓</span>}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Script Display */}
        <motion.div
          layout
          className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 flex-1 min-h-[200px] flex flex-col"
        >
          {isGenerating ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <p className="text-white/60 text-center">
                Generating announcement...
              </p>
            </div>
          ) : displayScript ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col"
            >
              {activeGuestId && (
                <div className="text-xs text-primary/80 font-medium mb-2 uppercase tracking-wider">
                  📢 Announcing:{" "}
                  {guests.find((g) => g.id === activeGuestId)?.name}
                </div>
              )}

              {/* Language toggle (Improvement 11) */}
              {scriptTelugu && (
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setSelectedLanguage("english")}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      selectedLanguage === "english"
                        ? "bg-white/20 text-white"
                        : "bg-white/5 text-white/50 hover:text-white/80"
                    }`}
                  >
                    🇬🇧 English
                  </button>
                  <button
                    onClick={() => setSelectedLanguage("telugu")}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      selectedLanguage === "telugu"
                        ? "bg-white/20 text-white"
                        : "bg-white/5 text-white/50 hover:text-white/80"
                    }`}
                  >
                    🇮🇳 Telugu
                  </button>
                </div>
              )}

              {selectedLanguage === "telugu" && !hasTeluguVoice && (
                <p className="text-xs text-amber-400 mb-2">
                  ⚠ Telugu voice not available on this device
                </p>
              )}

              <p className="text-lg leading-relaxed flex-1 text-white/90">
                {displayScript}
              </p>
              <Button
                onClick={handleSpeak}
                disabled={isSpeaking}
                variant="ghost"
                className="mt-4 text-white/70 hover:text-white hover:bg-white/10 self-end"
              >
                <Volume2 className="w-4 h-4 mr-2" />
                {isSpeaking ? "Speaking..." : "Speak Again"}
              </Button>
            </motion.div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-white/40">
              <Volume2 className="w-12 h-12" />
              <p className="text-center">
                {firstUnannounced
                  ? `Ready to announce ${firstUnannounced.name}`
                  : "All guests announced! 🎉"}
              </p>
            </div>
          )}
        </motion.div>

        {/* ── Next Guest Announce Button ── */}
        {firstUnannounced && (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            <Button
              onClick={() => startCountdownAndAnnounce(firstUnannounced.id)}
              disabled={isGenerating || isSpeaking || countingDown}
              className="w-full h-14 rounded-2xl text-lg font-bold bg-gradient-to-r from-violet-600 to-fuchsia-500 hover:from-violet-700 hover:to-fuchsia-600 shadow-xl"
            >
              {isGenerating ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <ChevronRight className="w-5 h-5 mr-2" />
              )}
              Announce: {firstUnannounced.name}
            </Button>
          </motion.div>
        )}

        {/* ── Up Next Preview (Improvement 7) ── */}
        <AnimatePresence mode="wait">
          {nextGuest ? (
            <motion.div
              key={nextGuest.id}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 0.6 }}
              exit={{ y: -10, opacity: 0 }}
              className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500/40 to-fuchsia-500/40 flex items-center justify-center text-lg">
                👤
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-white/40 uppercase tracking-wider font-bold">
                  Up Next →
                </p>
                <p className="text-sm font-medium truncate">{nextGuest.name}</p>
                <p className="text-xs text-white/40 truncate">
                  {nextGuest.title}
                </p>
              </div>
            </motion.div>
          ) : activeGuestId && guests.length > 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              className="text-center text-xs text-white/40 py-2"
            >
              ✨ This is the final guest
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* ── All Guests List ── */}
        <div className="space-y-2">
          <p className="text-xs text-white/40 uppercase tracking-wider px-1">
            All Guests
          </p>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {guests.map((guest) => (
              <motion.button
                key={guest.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => startCountdownAndAnnounce(guest.id)}
                disabled={isGenerating || isSpeaking || countingDown}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                  guest.id === activeGuestId
                    ? "bg-primary/20 border border-primary/40"
                    : guest.announced
                      ? "bg-green-500/10 border border-green-500/20"
                      : "bg-white/5 border border-white/10 hover:bg-white/10"
                } disabled:opacity-50`}
              >
                <span className="text-sm">{guest.announced ? "✓" : "○"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{guest.name}</p>
                  <p className="text-xs text-white/50 truncate">{guest.title}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </motion.button>
            ))}
          </div>
        </div>

        {/* ── Crowd Prompts ── */}
        <div className="space-y-2">
          <p className="text-xs text-white/40 uppercase tracking-wider px-1">
            Crowd Prompts
          </p>
          <div className="grid grid-cols-5 gap-2">
            {crowdButtons.map(({ action, icon, label, color }) => (
              <motion.button
                key={action}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleCrowdPrompt(action)}
                disabled={isSpeaking}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl text-white text-center ${color} disabled:opacity-50 transition-all shadow-lg`}
              >
                {icon}
                <span className="text-[10px] font-medium leading-tight">
                  {label}
                </span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* ── Emergency Announcement (Improvement 8) ── */}
        <div className="space-y-2">
          <AnimatePresence>
            {showEmergencyInput ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-red-400">
                      📢 Emergency Announcement
                    </p>
                    <button
                      onClick={() => {
                        setShowEmergencyInput(false);
                        setEmergencyText("");
                      }}
                      className="text-white/40 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <textarea
                    value={emergencyText}
                    onChange={(e) => setEmergencyText(e.target.value)}
                    placeholder="Type your emergency message..."
                    className="w-full bg-black/30 border border-red-500/20 rounded-lg p-3 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-red-500/50"
                    rows={3}
                    autoFocus
                  />
                  <Button
                    onClick={handleEmergencySpeak}
                    disabled={!emergencyText.trim()}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Speak Now
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <Button
                  onClick={() => setShowEmergencyInput(true)}
                  variant="ghost"
                  className="w-full h-10 rounded-xl border border-orange-500/30 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300 text-sm"
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  📢 Emergency Announcement
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Stop Button ── */}
        <Button
          onClick={handleStopHostMode}
          variant="ghost"
          className="w-full h-12 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
        >
          <Square className="w-4 h-4 mr-2" />
          End Host Mode
        </Button>
      </div>
    </div>
  );
}
