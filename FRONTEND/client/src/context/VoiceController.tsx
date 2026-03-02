import React, {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  useCallback,
  useEffect,
} from "react";
import { useSpeechRecognition, speakAsync } from "@/hooks/use-speech";
import { useLocation } from "wouter";
import { VoiceStatus } from "@/components/VoiceStatus";
import { useToast } from "@/hooks/use-toast";

// ============= STATE MACHINE TYPES =============
export type ConversationState =
  | "idle" // Mic off, no activity
  | "listening" // Listening for user speech
  | "processing" // Processing user input
  | "speaking" // Bot is speaking
  | "waiting_response" // Waiting for user response to greeting (3 sec grace)
  | "navigating" // In guidance/navigation mode
  | "error"; // Error state

export type NavigationMode = "none" | "directions" | "guiding";

export type Intent =
  | "greeting"
  | "navigation"
  | "guide"
  | "help"
  | "stop"
  | "unknown";

// ============= CONTEXT TYPE =============
type VoiceControllerContextType = {
  // State
  conversationState: ConversationState;
  navigationMode: NavigationMode;
  isListening: boolean;
  isSpeaking: boolean;
  currentIntent: Intent;
  transcript: string;
  destination: string | null;
  directions: string[] | null;

  // Controls
  toggleMic: (enabled: boolean) => void;
  dispatch: (intent: Intent, data?: any) => Promise<void>;
  setDestination: (dest: string | null) => void;
  setDirections: (dirs: string[] | null) => void;
};

const VoiceControllerContext = createContext<VoiceControllerContextType | null>(
  null,
);

export function useVoiceController() {
  const ctx = useContext(VoiceControllerContext);
  if (!ctx) throw new Error("VoiceController not available");
  return ctx;
}

// ============= INTENT DETECTION WITH CONFIDENCE =============
function detectIntent(transcript: string): {
  intent: Intent;
  confidence: number;
} {
  const lower = transcript.toLowerCase().trim();

  // Greeting patterns
  if (
    /\b(hello|hi|hey|guido|good\s*(morning|afternoon|evening))\b/i.test(lower)
  ) {
    return { intent: "greeting", confidence: 0.95 };
  }

  // Navigation patterns
  if (
    /\b(where|location|how\s*to|way\s*to|go\s*to|find|directions?)\b/i.test(
      lower,
    )
  ) {
    return { intent: "navigation", confidence: 0.85 };
  }

  // Guide/Lead patterns
  if (/\b(guide|lead|come|follow|take\s*me|show\s*way)\b/i.test(lower)) {
    return { intent: "guide", confidence: 0.9 };
  }

  // Help/Info patterns
  if (/\b(help|info|information|tell|explain|what|why)\b/i.test(lower)) {
    return { intent: "help", confidence: 0.8 };
  }

  // Stop patterns
  if (/\b(stop|cancel|exit|back|return|emergency)\b/i.test(lower)) {
    return { intent: "stop", confidence: 0.95 };
  }

  return { intent: "unknown", confidence: 0.0 };
}

// ============= DIRECTION DATABASE =============
const DIRECTIONS_DB: Record<string, string[]> = {
  A_BLOCK: [
    "Go to the main academic corridor.",
    "Follow the campus signboards for A Block.",
    "At the junction, take the route marked A Block and continue straight.",
  ],
  B_BLOCK: [
    "Go to the main academic corridor.",
    "Follow the campus signboards for B Block.",
    "At the junction, take the route marked B Block and continue straight.",
  ],
  ADMISSION: [
    "Go to the Admin Block front office area.",
    "Look for the Admissions counter signage.",
    "Ask the reception desk if you need further assistance.",
  ],
  FEE: [
    "Go to the Admin Block accounts area.",
    "Look for the Fee Payment or Accounts counter.",
    "Ask the reception desk if needed.",
  ],
  LIBRARY: [
    "Go to the main academic corridor.",
    "Follow signs for the Library in C Block.",
    "The library is on the second floor.",
  ],
  CANTEEN: [
    "Go to the D Block area.",
    "Look for the Canteen entrance.",
    "The canteen is open from 8 AM to 8 PM.",
  ],
};

// ============= PROVIDER COMPONENT =============
export function VoiceControllerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    state: speechState,
    transcript: rawTranscript,
    setTranscript,
    start: startSpeechRecognition,
    stop: stopSpeechRecognition,
    requestPermission,
  } = useSpeechRecognition();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  // ===== CORE STATE =====
  const [conversationState, setConversationState] =
    useState<ConversationState>("idle");
  const [navigationMode, setNavigationMode] = useState<NavigationMode>("none");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentIntent, setCurrentIntent] = useState<Intent>("unknown");
  const [displayTranscript, setDisplayTranscript] = useState("");
  const [destination, setDestination] = useState<string | null>(null);
  const [directions, setDirections] = useState<string[] | null>(null);

  // ===== REFS FOR TIMERS & STATE =====
  const greetingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoResetTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastInteractionRef = useRef<number>(Date.now());
  const isProcessingRef = useRef(false);
  const greetingBufferRef = useRef<string>("");

  // Request mic permission on mount
  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  // ===== AUTO RESET (60 seconds of inactivity) =====
  const resetToLanding = useCallback(() => {
    setConversationState("idle");
    setNavigationMode("none");
    setIsListening(false);
    setDisplayTranscript("");
    setDestination(null);
    setDirections(null);
    stopSpeechRecognition();
    if (location !== "/") setLocation("/");
  }, [location, setLocation, stopSpeechRecognition]);

  const scheduleAutoReset = useCallback(() => {
    lastInteractionRef.current = Date.now();
    if (autoResetTimeoutRef.current) clearTimeout(autoResetTimeoutRef.current);
    autoResetTimeoutRef.current = setTimeout(() => {
      resetToLanding();
    }, 60000); // 60 seconds
  }, [resetToLanding]);

  useEffect(() => {
    scheduleAutoReset();
    return () => {
      if (autoResetTimeoutRef.current)
        clearTimeout(autoResetTimeoutRef.current);
    };
  }, [scheduleAutoReset]);

  // ===== HANDLE SPEECH RECOGNITION STATE CHANGES =====
  useEffect(() => {
    if (speechState === "listening" && !isSpeaking) {
      // Only update to listening if not in greeting wait mode
      if (conversationState !== "waiting_response") {
        setConversationState("listening");
      }
      setDisplayTranscript(rawTranscript);
    } else if (speechState === "processing") {
      // Only update to processing if not in greeting wait mode
      if (conversationState !== "waiting_response") {
        setConversationState("processing");
      }
    } else if (speechState === "idle" && !isSpeaking) {
      if (conversationState === "waiting_response") {
        return; // Keep waiting state during greeting grace period
      }
      if (conversationState !== "navigating") {
        setConversationState("idle");
      }
    }
  }, [speechState, isSpeaking, conversationState, rawTranscript]);

  // ===== HANDLE TRANSCRIPT (USER SPEECH) =====
  useEffect(() => {
    if (speechState !== "processing" || !rawTranscript) return;
    if (isProcessingRef.current) return; // Prevent double processing
    if (isSpeaking) return; // Don't process if bot is speaking

    isProcessingRef.current = true;
    scheduleAutoReset();

    const processUserInput = async () => {
      const transcript = rawTranscript.trim();
      if (transcript.length < 2) {
        isProcessingRef.current = false;
        setTranscript("");
        return;
      }

      // If we're in greeting wait mode, check if this is continuation
      if (greetingTimeoutRef.current) {
        // User is continuing to speak - cancel greeting timer
        console.log(
          "[Voice] User continued speaking during greeting wait, cancelling timer...",
        );
        clearTimeout(greetingTimeoutRef.current);
        greetingTimeoutRef.current = null;

        // Combine with previous greeting if any
        const fullTranscript = greetingBufferRef.current
          ? `${greetingBufferRef.current} ${transcript}`.trim()
          : transcript;
        greetingBufferRef.current = "";

        // Re-detect intent on full transcript
        const { intent, confidence } = detectIntent(fullTranscript);
        setCurrentIntent(intent);
        setDisplayTranscript(fullTranscript);
        setConversationState("processing");

        // Process the full command
        if (intent === "navigation") {
          await handleNavigation(fullTranscript);
        } else if (intent === "guide") {
          await handleGuideRequest();
        } else if (intent === "stop") {
          await handleStop();
        } else {
          // Unknown intent after greeting - just respond
          await speakAndResume(
            "I'm sorry, I didn't understand that. Could you please repeat?",
            true,
          );
        }

        setTranscript("");
        isProcessingRef.current = false;
        return;
      }

      // Fresh speech (not during greeting wait)
      const { intent, confidence } = detectIntent(transcript);
      setCurrentIntent(intent);
      setDisplayTranscript(transcript);

      // Route based on intent
      if (intent === "greeting" && confidence > 0.9) {
        // Store greeting and start 3-second wait
        console.log("[Voice] Greeting detected, starting 3-second wait...");
        greetingBufferRef.current = transcript;
        setConversationState("waiting_response");

        // Keep mic listening and wait for more speech
        greetingTimeoutRef.current = setTimeout(async () => {
          console.log(
            "[Voice] 3-second wait complete, no additional speech - responding to greeting",
          );
          greetingTimeoutRef.current = null;
          greetingBufferRef.current = "";

          // No additional speech - respond to greeting
          await handleGreeting();
        }, 3000);

        // Don't clear transcript yet - keep listening
        setTranscript("");
        isProcessingRef.current = false;
      } else if (intent === "navigation") {
        await handleNavigation(transcript);
        setTranscript("");
        isProcessingRef.current = false;
      } else if (intent === "guide") {
        await handleGuideRequest();
        setTranscript("");
        isProcessingRef.current = false;
      } else if (intent === "stop") {
        await handleStop();
        setTranscript("");
        isProcessingRef.current = false;
      } else if (intent === "unknown") {
        // Only respond if it contains wake word
        if (/\b(guido|hello|hi|hey)\b/i.test(transcript)) {
          await speakAndResume(
            "I'm sorry, I didn't understand that. Could you please repeat?",
            true,
          );
        }
        setTranscript("");
        isProcessingRef.current = false;
      } else {
        setTranscript("");
        isProcessingRef.current = false;
      }
    };

    void processUserInput();
  }, [rawTranscript, speechState, isSpeaking, scheduleAutoReset]);

  // ===== CORE HANDLERS =====

  const speakAndResume = useCallback(
    async (text: string, shouldResume: boolean = true) => {
      if (!text) return;

      console.log(`[Voice] Bot speaking: "${text.substring(0, 50)}..."`);
      console.log(`[Voice] Will resume listening: ${shouldResume}`);

      // ALWAYS stop current recognition completely first
      stopSpeechRecognition();
      setIsListening(false);

      setIsSpeaking(true);
      setConversationState("speaking");
      setDisplayTranscript(text);

      try {
        await speakAsync(text);
        console.log("[Voice] Bot finished speaking");
      } catch (error) {
        console.error("[Voice] Speech synthesis error:", error);
      } finally {
        setIsSpeaking(false);

        // Resume listening if needed - with small delay to ensure recognizer is ready
        if (shouldResume && conversationState !== "navigating") {
          console.log("[Voice] Resuming listening after bot speech...");
          setTimeout(() => {
            setIsListening(true);
            startSpeechRecognition();
            setConversationState("listening");
            console.log("[Voice] Mic reactivated after bot speech");
          }, 100); // Small delay to ensure recognizer is ready
        } else {
          setConversationState("idle");
          console.log("[Voice] Not resuming listening, conversation ended");
        }
      }
    },
    [conversationState, startSpeechRecognition, stopSpeechRecognition],
  );

  const handleGreeting = useCallback(async () => {
    greetingTimeoutRef.current = null;
    greetingBufferRef.current = "";
    setConversationState("speaking");
    await speakAndResume("Welcome. How can I assist you today?", true);
  }, [speakAndResume]);

  const handleNavigation = useCallback(
    async (transcript: string) => {
      // Extract destination from speech
      let dest = "A_BLOCK"; // Default

      if (/\b(a\s*block)\b/i.test(transcript)) dest = "A_BLOCK";
      else if (/\b(b\s*block)\b/i.test(transcript)) dest = "B_BLOCK";
      else if (/\b(admin|admission)\b/i.test(transcript)) dest = "ADMISSION";
      else if (/\b(fee|payment)\b/i.test(transcript)) dest = "FEE";
      else if (/\b(library)\b/i.test(transcript)) dest = "LIBRARY";
      else if (/\b(canteen|cafe)\b/i.test(transcript)) dest = "CANTEEN";

      setDestination(dest);
      setDirections(DIRECTIONS_DB[dest] || []);
      setNavigationMode("directions");

      const label = dest.replace(/_/g, " ");
      const dirs = DIRECTIONS_DB[dest] || [];
      const dirText = dirs.join(" Then ");

      await speakAndResume(
        `${label} is located on campus. ${dirText} Would you like me to guide you there?`,
        true,
      );
    },
    [speakAndResume],
  );

  const handleGuideRequest = useCallback(
    async (overrideDestination?: string) => {
      const activeDestination = overrideDestination ?? destination;
      if (!activeDestination) {
        await speakAndResume(
          "I don't have a destination set. Please tell me where you'd like to go.",
          true,
        );
        return;
      }

      setNavigationMode("guiding");
      setConversationState("navigating");
      setIsListening(false);
      if (isListening) stopSpeechRecognition();

      await speakAndResume(
        "Please follow me. I will guide you safely to your destination.",
        false,
      );
    },
    [destination, isListening, stopSpeechRecognition, speakAndResume],
  );

  const handleStop = useCallback(async () => {
    setNavigationMode("none");
    setDestination(null);
    setDirections(null);

    await speakAndResume("Navigation cancelled. Returning to home.", true);

    setTimeout(() => {
      setLocation("/");
      setConversationState("idle");
    }, 2000);
  }, [setLocation, speakAndResume]);

  const toggleMic = useCallback(
    (enabled: boolean) => {
      console.log(`[Voice] Mic toggle: ${enabled ? "ON" : "OFF"}`);
      if (enabled) {
        setIsListening(true);
        startSpeechRecognition();
        setConversationState("listening");
        scheduleAutoReset();
        console.log("[Voice] Mic activated, listening started");
      } else {
        setIsListening(false);
        stopSpeechRecognition();
        setConversationState("idle");
        setDisplayTranscript("");

        // Clear any pending timeouts
        if (greetingTimeoutRef.current) {
          clearTimeout(greetingTimeoutRef.current);
          greetingTimeoutRef.current = null;
        }
        greetingBufferRef.current = "";
        console.log("[Voice] Mic deactivated, listening stopped");
      }
    },
    [startSpeechRecognition, stopSpeechRecognition, scheduleAutoReset],
  );

  const dispatch = useCallback(
    async (intent: Intent, data?: any) => {
      switch (intent) {
        case "greeting":
          await handleGreeting();
          break;
        case "navigation":
          await handleNavigation(data?.transcript || "");
          break;
        case "guide":
          await handleGuideRequest(data?.destination);
          break;
        case "stop":
          await handleStop();
          break;
        default:
          break;
      }
    },
    [handleGreeting, handleNavigation, handleGuideRequest, handleStop],
  );

  // ===== CONTEXT VALUE =====
  const value = useMemo(
    () => ({
      conversationState,
      navigationMode,
      isListening,
      isSpeaking,
      currentIntent,
      transcript: displayTranscript,
      destination,
      directions,
      toggleMic,
      dispatch,
      setDestination,
      setDirections,
    }),
    [
      conversationState,
      navigationMode,
      isListening,
      isSpeaking,
      currentIntent,
      displayTranscript,
      destination,
      directions,
    ],
  );

  return (
    <VoiceControllerContext.Provider value={value}>
      {children}
      <VoiceStatus
        state={
          isSpeaking
            ? "speaking"
            : conversationState === "waiting_response"
              ? "listening"
              : isListening
                ? "listening"
                : conversationState === "processing"
                  ? "processing"
                  : "idle"
        }
        text={
          conversationState === "waiting_response"
            ? "Waiting for more... (3s)"
            : displayTranscript
        }
      />
    </VoiceControllerContext.Provider>
  );
}
