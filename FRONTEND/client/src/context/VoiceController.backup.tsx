import React, {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSpeechRecognition, speakAsync } from "@/hooks/use-speech";
import {
  sendVoiceCommand,
  type UiContext,
  type VoiceApiResponse,
} from "@/lib/voice";
import { useLocation } from "wouter";
import { VoiceStatus } from "@/components/VoiceStatus";
import { useToast } from "@/hooks/use-toast";

export type VoiceEvent = VoiceApiResponse & { receivedAt: number };

type GuidanceMode = "none" | "directions" | "guiding";

type VoiceControllerContextType = {
  currentTask: string | null;
  destination: VoiceApiResponse["target"] | null;
  guidanceMode: GuidanceMode;
  directions: string[] | null;
  dispatch: (event: VoiceEvent) => void;
  setAlwaysListening: (enabled: boolean) => void;
  start: () => void;
  stop: () => void;
  state: "idle" | "listening" | "processing" | "speaking";
};

const VoiceControllerContext = createContext<VoiceControllerContextType | null>(
  null,
);

export function useVoiceController() {
  const ctx = useContext(VoiceControllerContext);
  if (!ctx) throw new Error("VoiceController not available");
  return ctx;
}

export function VoiceControllerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { state, transcript, setTranscript, start, stop, requestPermission } =
    useSpeechRecognition();
  const [location, setLocation] = useLocation();
  const [currentTask, setCurrentTask] = useState<string | null>(null);
  const [destination, setDestination] = useState<
    VoiceApiResponse["target"] | null
  >(null);
  const [guidanceMode, setGuidanceMode] = useState<GuidanceMode>("none");
  const [directions, setDirections] = useState<string[] | null>(null);
  const [subtitle, setSubtitle] = useState<string>("");
  const [alwaysListening, setAlwaysListeningState] = useState(false);
  const pendingTargetRef = useRef<VoiceApiResponse["target"] | null>(null);
  const lastEventRef = useRef<{ intent: string; at: number } | null>(null);
  const lastProcessedAtRef = useRef<number>(0);
  const { toast } = useToast();

  React.useEffect(() => {
    requestPermission();
  }, []);

  React.useEffect(() => {
    async function handleTranscript() {
      if (state !== "processing" || !transcript) return;

      const now = Date.now();
      // Cooldown prevents rapid-fire noise triggers from spamming API.
      if (now - lastProcessedAtRef.current < 750) {
        setTranscript("");
        return;
      }
      lastProcessedAtRef.current = now;

      const normalized = transcript.trim();
      const normalizedLower = normalized.toLowerCase();

      // Ignore very short/noisy inputs (especially in always-listening mode)
      const hasLettersOrNumbers = /[a-z0-9]/i.test(normalizedLower);
      if (!hasLettersOrNumbers || normalizedLower.length < 3) {
        setTranscript("");
        return;
      }

      // Greeting logic: respond to "hello" or similar, with 3s wait after user stops
      if (["hello", "hi", "hey", "hello guido", "hello campus companion"].some(greet => normalizedLower.includes(greet))) {
        setTimeout(async () => {
          await sayAndResume("Welcome! How can I assist you today?");
        }, 3000);
        setTranscript("");
        return;
      }

      // If we previously asked a confirmation question, handle yes/no/thanks locally.
      const pendingTarget = pendingTargetRef.current;
      if (pendingTarget) {
        const localFollowUp = tryResolveFollowUp(
          normalizedLower,
          pendingTarget,
        );
        if (localFollowUp) {
          // If user didn't confirm guidance, clear pending confirmation.
          if (localFollowUp.ui_action !== "START_GUIDANCE") {
            pendingTargetRef.current = null;
          }
          dispatch({ ...localFollowUp, receivedAt: Date.now() });
          setTranscript("");
          return;
        }
      }

      // Common commands can be handled locally to avoid LLM/API errors.
      const local = tryParseLocalCommand(normalizedLower);
      if (local) {
        dispatch({ ...local, receivedAt: Date.now() });
        setTranscript("");
        return;
      }

      const uiContext: UiContext = {
        current_page: location || "/",
        available_actions: getAvailableActions(location || "/"),
      };
      try {
        const resp = await sendVoiceCommand(normalized, uiContext);
        const event: VoiceEvent = { ...resp, receivedAt: Date.now() };
        dispatch(event);
      } catch (e: any) {
        const message = e?.message || "Voice request failed";
        toast({
          title: "Voice error",
          description: message,
          variant: "destructive",
        });
        setSubtitle("Voice service unavailable. Use the buttons.");
        await sayAndResume("Sorry, something went wrong. You can use the buttons.");
      } finally {
        setTranscript("");
      }
    }
    handleTranscript();
  }, [state, transcript]);

  // Live transcript subtitle while listening
  React.useEffect(() => {
    if (state === "listening") {
      setSubtitle(transcript);
    }
  }, [state, transcript]);

  async function sayAndResume(text: string) {
    if (!text) return;
    setSubtitle(text);

    // In always-listening mode, stop recognition while speaking to avoid feedback loops.
    const resume = alwaysListening;
    if (resume) stop();
    await speakAsync(text);
    if (resume) {
      window.setTimeout(() => start(), 250);
    }
  }

  function dispatch(event: VoiceEvent) {
    // Debounce duplicate intents within 1.5s
    const last = lastEventRef.current;
    if (last && event.intent === last.intent && Date.now() - last.at < 1500) {
      return;
    }
    lastEventRef.current = { intent: event.intent, at: Date.now() };

    // Directions-first guidance flow.
    if (event.intent === "GUIDE" && event.target !== "NONE") {
      const { steps, spoken } = getDirectionsForTarget(event.target);
      setDestination(event.target);
      setDirections(steps);

      if (event.ui_action === "SHOW_INFO") {
        // First step: show directions and ask for confirmation.
        setGuidanceMode("directions");
        setLocation("/visitor");
        setCurrentTask(`Directions to ${event.target}`);
        pendingTargetRef.current = event.target;
        void sayAndResume(
          `${event.response_text || spoken} Would you like me to guide you there? Say "yes guide me" or "no just directions".`,
        );
        return;
      }

      if (event.ui_action === "START_GUIDANCE") {
        const pending = pendingTargetRef.current;

        // If we were waiting for confirmation, this is the confirmation.
        if (pending === event.target) {
          pendingTargetRef.current = null;
          setGuidanceMode("guiding");
          setLocation("/visitor");
          setCurrentTask(`Guiding to ${event.target}`);
          void sayAndResume(event.response_text || "Okay. Please follow me.");
          return;
        }

        // User likely asked to guide explicitly in one phrase.
        pendingTargetRef.current = null;
        setGuidanceMode("guiding");
        setLocation("/visitor");
        setCurrentTask(`Guiding to ${event.target}`);
        void sayAndResume(
          `${event.response_text || "Okay. Please follow me."} ${spoken}`.trim(),
        );
        return;
      }
    }

    // Speak back (non-guidance or already confirmed guidance)
    if (event.response_text) {
      void sayAndResume(event.response_text);
    }

    // UI actions mapping
    switch (event.ui_action) {
      case "OPEN_PAGE": {
        const targetPath = mapTargetToPath(event.target);
        if (targetPath) setLocation(targetPath);
        break;
      }
      case "START_GUIDANCE": {
        // Confirmed guidance
        pendingTargetRef.current = null;
        setDestination(event.target !== "NONE" ? event.target : destination);
        setGuidanceMode("guiding");
        setLocation("/visitor");
        setCurrentTask(`Guiding to ${event.target}`);
        break;
      }
      case "GO_BACK": {
        pendingTargetRef.current = null;
        setGuidanceMode("none");
        setDestination(null);
        setDirections(null);
        window.history.back();
        setCurrentTask(null);
        break;
      }
      case "SHOW_INFO": {
        // Keep current page
        break;
      }
    }
  }

  function setAlwaysListening(enabled: boolean) {
    setAlwaysListeningState(enabled);
    if (enabled) start();
    else stop();
  }

  const value = useMemo(
    () => ({
      currentTask,
      destination,
      guidanceMode,
      directions,
      dispatch,
      setAlwaysListening,
      start,
      stop,
      state,
    }),
    [currentTask, destination, guidanceMode, directions, state],
  );

  return (
    <VoiceControllerContext.Provider value={value}>
      {children}
      {/* Global voice state indicator & subtitles */}
      <VoiceStatus
        state={state}
        text={
          state === "listening" || state === "processing"
            ? subtitle || undefined
            : (currentTask ?? subtitle) || undefined
        }
      />
    </VoiceControllerContext.Provider>
  );
}

function getDirectionsForTarget(target: VoiceApiResponse["target"]): {
  steps: string[];
  spoken: string;
} {
  const label = targetLabel(target);
  const steps: Record<VoiceApiResponse["target"], string[]> = {
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
      "Go to the Admin Block / Front Office area.",
      "Look for the Admissions counter signage.",
      "If needed, ask the reception desk for Admissions.",
    ],
    FEE: [
      "Go to the Admin Block / Accounts area.",
      "Look for the Fee Payment / Accounts counter.",
      "If needed, ask the reception desk for Fee Payment.",
    ],
    NONE: [],
  };

  const list = steps[target] ?? [];
  const spoken =
    list.length > 0
      ? `Here are the directions to ${label}. First, ${list[0]} Then, ${list[1] || "follow the signs"}. Finally, ${list[2] || "you will reach the destination"}.`
      : `Here are the directions to ${label}.`;

  return { steps: list, spoken };
}

function targetLabel(target: VoiceApiResponse["target"]): string {
  switch (target) {
    case "A_BLOCK":
      return "A Block";
    case "B_BLOCK":
      return "B Block";
    case "ADMISSION":
      return "Admissions";
    case "FEE":
      return "Fee Payment";
    default:
      return "the destination";
  }
}

function tryResolveFollowUp(
  transcriptLower: string,
  target: VoiceApiResponse["target"],
): VoiceApiResponse | null {
  if (/\b(thank\s*you|thanks|thanku)\b/.test(transcriptLower)) {
    return {
      intent: "HELP",
      target: "NONE",
      ui_action: "SHOW_INFO",
      response_text: "You're welcome. Anything else you need?",
    };
  }

  if (
    /\b(yes|yeah|ok|okay|guide\s*me|follow\s*me|lets\s*go|let's\s*go)\b/.test(
      transcriptLower,
    )
  ) {
    return {
      intent: "GUIDE",
      target,
      ui_action: "START_GUIDANCE",
      response_text: "Okay. Please follow me.",
    };
  }

  if (
    /\b(no\s*travel|don't\s*travel|dont\s*travel|no\s*follow|don't\s*follow|dont\s*follow|just\s*directions|only\s*directions|no|not\s*now)\b/.test(
      transcriptLower,
    )
  ) {
    return {
      intent: "HELP",
      target: "NONE",
      ui_action: "SHOW_INFO",
      response_text:
        "Okay. I will not guide you. The directions are shown on screen.",
    };
  }

  if (/\b(stop|cancel)\b/.test(transcriptLower)) {
    return {
      intent: "STOP",
      target: "NONE",
      ui_action: "GO_BACK",
      response_text: "Okay, stopping navigation.",
    };
  }

  return null;
}

function tryParseLocalCommand(
  transcriptLower: string,
): VoiceApiResponse | null {
  // Navigation cancel/stop
  if (/\b(emergency\s*stop|stop|cancel)\b/.test(transcriptLower)) {
    return {
      intent: "STOP",
      target: "NONE",
      ui_action: "GO_BACK",
      response_text: "Stopping.",
    };
  }

  if (/\b(thank\s*you|thanks|thanku)\b/.test(transcriptLower)) {
    return {
      intent: "HELP",
      target: "NONE",
      ui_action: "SHOW_INFO",
      response_text: "You're welcome.",
    };
  }

  // Travel to locations
  if (/\b(a\s*block)\b/.test(transcriptLower)) {
    return {
      intent: "GUIDE",
      target: "A_BLOCK",
      ui_action: "SHOW_INFO",
      response_text: "",
    };
  }
  if (/\b(b\s*block)\b/.test(transcriptLower)) {
    return {
      intent: "GUIDE",
      target: "B_BLOCK",
      ui_action: "SHOW_INFO",
      response_text: "",
    };
  }
  if (/\b(admission|admissions)\b/.test(transcriptLower)) {
    return {
      intent: "GUIDE",
      target: "ADMISSION",
      ui_action: "SHOW_INFO",
      response_text: "",
    };
  }
  if (/\b(fee|fee\s*payment|accounts)\b/.test(transcriptLower)) {
    return {
      intent: "GUIDE",
      target: "FEE",
      ui_action: "SHOW_INFO",
      response_text: "",
    };
  }

  return null;
}

function getAvailableActions(path: string): string[] {
  if (path === "/")
    return ["Visitor Help", "Faculty & Office", "Campus Information"];
  if (path === "/visitor")
    return ["Select Destination", "Guide Me", "Cancel Navigation"];
  if (path === "/faculty")
    return ["Call to Me", "Send Item", "Verify Access", "Cancel / Return"];
  return [];
}

function mapTargetToPath(target: string): string | null {
  switch (target) {
    case "ADMISSION":
    case "FEE":
    case "A_BLOCK":
    case "B_BLOCK":
      return "/visitor"; // Navigate to visitor page for campus locations
    default:
      return null;
  }
}
