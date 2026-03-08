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
} from "lucide-react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

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

// ── TTS Helper ──

function speakTTS(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) {
      reject(new Error("speechSynthesis not available"));
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Try to use a good voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) =>
        v.lang.startsWith("en") &&
        (v.name.includes("Google") || v.name.includes("Samantha") || v.name.includes("Daniel")),
    );
    if (preferred) utterance.voice = preferred;

    utterance.onend = () => resolve();
    utterance.onerror = (e) => reject(e);

    window.speechSynthesis.speak(utterance);
  });
}

// ── Component ──

export default function HostMode() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // State
  const [event, setEvent] = useState<EventData | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [activeGuestId, setActiveGuestId] = useState<string | null>(null);
  const [currentScript, setCurrentScript] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showRunsheet, setShowRunsheet] = useState(false);

  // Ref for voices loaded
  const voicesLoaded = useRef(false);

  // Load voices
  useEffect(() => {
    const loadVoices = () => {
      window.speechSynthesis?.getVoices();
      voicesLoaded.current = true;
    };
    loadVoices();
    window.speechSynthesis?.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis?.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

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

  // ── Announce guest ──
  const handleAnnounce = async (guestId: string) => {
    setIsGenerating(true);
    setActiveGuestId(guestId);
    setCurrentScript(null);

    try {
      const res = await fetch(`/api/host/announce/${guestId}`, {
        method: "POST",
      });
      const json = await res.json();

      if (json.ok && json.data?.script) {
        const script = json.data.script;
        setCurrentScript(script);

        // Auto-speak the announcement
        setIsSpeaking(true);
        try {
          await speakTTS(script);
        } catch (e) {
          console.error("[HostMode] TTS error:", e);
        } finally {
          setIsSpeaking(false);
        }

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
    setIsSpeaking(true);
    try {
      await speakTTS(currentScript);
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
        const script = json.data.script;
        setCurrentScript(script);
        setActiveGuestId(null);

        setIsSpeaking(true);
        try {
          await speakTTS(script);
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

  // ── Stop host mode ──
  const handleStopHostMode = async () => {
    window.speechSynthesis?.cancel();
    try {
      await fetch("/api/host/mode/stop", { method: "POST" });
    } catch (e) {
      console.error("[HostMode] Stop mode error:", e);
    }
    setLocation("/event-setup");
  };

  // ── Get next unannounced guest ──
  const nextGuest = guests.find((g) => !g.announced);

  // ── Crowd prompt buttons ──
  const crowdButtons: { action: CrowdAction; icon: React.ReactNode; label: string; color: string }[] = [
    { action: "welcome", icon: <Heart className="w-4 h-4" />, label: "Welcome", color: "bg-blue-500 hover:bg-blue-600" },
    { action: "applause", icon: <Hand className="w-4 h-4" />, label: "Applause", color: "bg-amber-500 hover:bg-amber-600" },
    { action: "seated", icon: <Users className="w-4 h-4" />, label: "Be Seated", color: "bg-teal-500 hover:bg-teal-600" },
    { action: "break", icon: <Coffee className="w-4 h-4" />, label: "Break", color: "bg-orange-500 hover:bg-orange-600" },
    { action: "thankyou", icon: <Heart className="w-4 h-4" />, label: "Thank You", color: "bg-rose-500 hover:bg-rose-600" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white p-4 max-w-lg mx-auto flex flex-col">
      {/* Header */}
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
            {event && (
              <p className="text-sm text-white/60">{event.name}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-white/60 hover:text-white hover:bg-white/10 text-xs"
            onClick={() => setShowRunsheet(!showRunsheet)}
          >
            📋 {showRunsheet ? "Hide" : "Runsheet"}
          </Button>
          <div className={`w-2 h-2 rounded-full ${isSpeaking ? "bg-green-400 animate-pulse" : "bg-white/30"}`} />
        </div>
      </div>

      {/* Runsheet Sidebar */}
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

      {/* Main Content: Current Script */}
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
          ) : currentScript ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col"
            >
              {activeGuestId && (
                <div className="text-xs text-primary/80 font-medium mb-2 uppercase tracking-wider">
                  📢 Announcing: {guests.find((g) => g.id === activeGuestId)?.name}
                </div>
              )}
              <p className="text-lg leading-relaxed flex-1 text-white/90">
                {currentScript}
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
                {nextGuest
                  ? `Ready to announce ${nextGuest.name}`
                  : "All guests announced! 🎉"}
              </p>
            </div>
          )}
        </motion.div>

        {/* Next Guest Announce Button */}
        {nextGuest && (
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            <Button
              onClick={() => handleAnnounce(nextGuest.id)}
              disabled={isGenerating || isSpeaking}
              className="w-full h-14 rounded-2xl text-lg font-bold bg-gradient-to-r from-violet-600 to-fuchsia-500 hover:from-violet-700 hover:to-fuchsia-600 shadow-xl"
            >
              {isGenerating ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <ChevronRight className="w-5 h-5 mr-2" />
              )}
              Announce: {nextGuest.name}
            </Button>
          </motion.div>
        )}

        {/* All Guests List (tap to announce specific) */}
        <div className="space-y-2">
          <p className="text-xs text-white/40 uppercase tracking-wider px-1">
            All Guests
          </p>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {guests.map((guest) => (
              <motion.button
                key={guest.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleAnnounce(guest.id)}
                disabled={isGenerating || isSpeaking}
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

        {/* Crowd Prompts */}
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

        {/* Stop Button */}
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
