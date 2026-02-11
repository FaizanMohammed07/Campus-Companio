/* Minimal Web Speech API hook for STT + state */
import { useEffect, useRef, useState } from "react";

export type SpeechState = "idle" | "listening" | "processing" | "speaking";

export function useSpeechRecognition() {
  const [state, setState] = useState<SpeechState>("idle");
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
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
        recognition.start();
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
          setState("listening");
        }
      }
      if (finalText.trim()) {
        setTranscript(finalText.trim());
        setState("processing");
      }
    };

    return () => {
      try { recognition.stop(); } catch {}
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
    recognition.start();
  };

  const stop = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    setListening(false);
    try { recognition.stop(); } catch {}
    setState("idle");
  };

  return { state, transcript, setTranscript, start, stop, requestPermission, listening, setListening };
}

export function speak(text: string) {
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1.0; // calm
  utter.pitch = 1.0;
  utter.volume = 1.0;
  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
}
