/* Minimal Web Speech API hook for STT + state */
import { useEffect, useRef, useState } from "react";

export type SpeechState = "idle" | "listening" | "processing" | "speaking";

export function useSpeechRecognition() {
  const [state, setState] = useState<SpeechState>("idle");
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const finalBufferRef = useRef<string>("");
  const finalFlushTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";

    recognition.onstart = () => setState("listening");
    recognition.onend = () => {
      setState("idle");
      if (listening) {
        // Auto-restart for always-listening mode
        try {
          recognition.start();
        } catch {
          // ignore "already started" and similar browser quirks
        }
      }
    };
    recognition.onerror = () => setState("idle");

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
        setTranscript(buffered);
        setState("processing");
      }, 450);
    };

    if (listening) {
      try {
        recognition.start();
      } catch {
        // already started
      }
    }

    return () => {
      if (finalFlushTimerRef.current) {
        window.clearTimeout(finalFlushTimerRef.current);
        finalFlushTimerRef.current = null;
      }
      try {
        recognition.stop();
      } catch {}
    };
  }, [listening]);

  const requestPermission = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      console.error("Microphone permission denied", e);
    }
  };

  const start = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
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
    setListening(false);
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
