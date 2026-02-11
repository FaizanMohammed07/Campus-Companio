import React, {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSpeechRecognition, speak } from "@/hooks/use-speech";
import {
  sendVoiceCommand,
  type UiContext,
  type VoiceApiResponse,
} from "@/lib/voice";
import { useLocation } from "wouter";
import { VoiceStatus } from "@/components/VoiceStatus";
import { useToast } from "@/hooks/use-toast";

export type VoiceEvent = VoiceApiResponse & { receivedAt: number };

type VoiceControllerContextType = {
  currentTask: string | null;
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
  const [subtitle, setSubtitle] = useState<string>("");
  const lastIntentRef = useRef<string>("");
  const { toast } = useToast();

  React.useEffect(() => {
    requestPermission();
  }, []);

  React.useEffect(() => {
    async function handleTranscript() {
      if (state !== "processing" || !transcript) return;
      const uiContext: UiContext = {
        current_page: location || "/",
        available_actions: getAvailableActions(location || "/"),
      };
      try {
        const resp = await sendVoiceCommand(transcript, uiContext);
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
        speak("Sorry, something went wrong. You can use the buttons.");
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

  function dispatch(event: VoiceEvent) {
    // Debounce duplicate intents within 1.5s
    if (
      event.intent === lastIntentRef.current &&
      Date.now() - event.receivedAt < 1500
    ) {
      return;
    }
    lastIntentRef.current = event.intent;

    // Speak back
    if (event.response_text) {
      setSubtitle(event.response_text);
      speak(event.response_text);
    }

    // UI actions mapping
    switch (event.ui_action) {
      case "OPEN_PAGE": {
        const targetPath = mapTargetToPath(event.target);
        if (targetPath) setLocation(targetPath);
        break;
      }
      case "START_GUIDANCE": {
        setLocation("/visitor");
        setCurrentTask(`Guiding to ${event.target}`);
        break;
      }
      case "GO_BACK": {
        window.history.back();
        setCurrentTask(null);
        break;
      }
      case "SHOW_INFO": {
        // No-op or show options; keep current page
        break;
      }
    }
  }

  function setAlwaysListening(enabled: boolean) {
    if (enabled) start();
    else stop();
  }

  const value = useMemo(
    () => ({ currentTask, dispatch, setAlwaysListening, start, stop, state }),
    [currentTask, state],
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
