/* Minimal Web Speech API hook for STT + state */
import { useEffect, useRef, useState } from "react";

export type SpeechState = "idle" | "listening" | "processing" | "speaking";

export function useSpeechRecognition() {
  const [state, setState] = useState<SpeechState>("idle");
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(
    null,
  );
  const recognitionRef = useRef<any>(null);
  const finalBufferRef = useRef<string>("");
  const finalFlushTimerRef = useRef<number | null>(null);
  const shouldListenRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";

    recognition.onstart = () => {
      if (!isMountedRef.current) return;
      setState("listening");
      setListening(true);
    };
    recognition.onend = () => {
      if (!isMountedRef.current) return;
      setState("idle");

      // Auto-restart if mic should remain on
      if (shouldListenRef.current) {
        if (restartTimerRef.current) {
          window.clearTimeout(restartTimerRef.current);
        }
        restartTimerRef.current = window.setTimeout(() => {
          try {
            recognition.start();
          } catch {
            // ignore browser quirks; next onend cycle can retry
          }
        }, 200);
      }
    };
    recognition.onerror = (event: any) => {
      if (!isMountedRef.current) return;
      setState("idle");

      // Fatal cases: do not keep looping
      if (
        event?.error === "not-allowed" ||
        event?.error === "service-not-allowed"
      ) {
        shouldListenRef.current = false;
        setListening(false);
        return;
      }

      // Recoverable errors: retry if mic should stay on
      if (shouldListenRef.current) {
        if (restartTimerRef.current) {
          window.clearTimeout(restartTimerRef.current);
        }
        restartTimerRef.current = window.setTimeout(() => {
          try {
            recognition.start();
          } catch {
            // ignore
          }
        }, 300);
      }
    };

    recognition.onresult = (event: any) => {
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          finalText += text + " ";
        } else {
          setTranscript(text);
          // Only set to listening if not already processing
          setState((prev) =>
            prev === "processing" ? "processing" : "listening",
          );
        }
      }

      const trimmedFinal = finalText.trim();
      if (!trimmedFinal) return;

      console.log(`[SpeechRec] Final transcript: "${trimmedFinal}"`);

      // Buffer final chunks so fast/continuous speech doesn't trigger multiple requests.
      finalBufferRef.current =
        `${finalBufferRef.current} ${trimmedFinal}`.trim();
      if (finalFlushTimerRef.current) {
        window.clearTimeout(finalFlushTimerRef.current);
      }
      finalFlushTimerRef.current = window.setTimeout(() => {
        const buffered = finalBufferRef.current.trim();
        finalBufferRef.current = "";
        finalFlushTimerRef.current = null;
        if (!buffered) return;
        console.log(`[SpeechRec] Setting transcript to: "${buffered}"`);
        setTranscript(buffered);
        setState("processing");
      }, 450);
    };

    return () => {
      isMountedRef.current = false;
      if (finalFlushTimerRef.current) {
        window.clearTimeout(finalFlushTimerRef.current);
        finalFlushTimerRef.current = null;
      }
      if (restartTimerRef.current) {
        window.clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      try {
        recognition.stop();
      } catch {}
    };
  }, []);

  const requestPermission = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermissionGranted(true);
    } catch (e) {
      setPermissionGranted(false);
      console.error("Microphone permission denied", e);
    }
  };

  const start = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    shouldListenRef.current = true;
    setListening(true);
    try {
      recognition.start();
    } catch {
      // ignore
    }
  };

  const stop = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    shouldListenRef.current = false;
    setListening(false);
    if (restartTimerRef.current) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    try {
      recognition.stop();
    } catch {}
    setState("idle");
  };

  return {
    state,
    transcript,
    setTranscript,
    start,
    stop,
    requestPermission,
    listening,
    setListening,
    permissionGranted,
  };
}

export function speakAsync(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve();
      return;
    }
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.0; // calm
    utter.pitch = 1.0;
    utter.volume = 1.0;
    utter.onend = () => resolve();
    utter.onerror = () => resolve();
    speechSynthesis.cancel();
    speechSynthesis.speak(utter);
  });
}

export function speak(text: string) {
  void speakAsync(text);
}
