import { useState } from "react";
import { useVoiceController } from "@/context/VoiceController";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";

export function MicrophoneControl() {
  const { toggleMic, isListening, isSpeaking, conversationState } =
    useVoiceController();
  const [micEnabled, setMicEnabled] = useState(false);

  const handleToggle = () => {
    if (micEnabled) {
      toggleMic(false);
      setMicEnabled(false);
    } else {
      toggleMic(true);
      setMicEnabled(true);
    }
  };

  // Determine visual state
  const isActive = micEnabled;
  const isAnimating = isListening && micEnabled && !isSpeaking;

  return (
    <div className="fixed bottom-20 right-4 z-50">
      <div className="relative">
        {/* Listening pulse ring - only when actively listening */}
        {isAnimating && (
          <div className="absolute inset-0 rounded-full border-2 border-blue-400 animate-pulse opacity-75" />
        )}

        {/* Mic button */}
        <Button
          onClick={handleToggle}
          className={`relative w-16 h-16 rounded-full flex flex-col items-center justify-center gap-0.5 font-semibold text-xs transition-all duration-200 ${
            isActive
              ? "bg-blue-500 hover:bg-blue-600 text-white shadow-lg"
              : "bg-gray-300 hover:bg-gray-400 text-gray-700 shadow-md"
          } ${isAnimating ? "ring-2 ring-blue-300" : ""}`}
          disabled={isSpeaking}
          aria-label={micEnabled ? "Turn off mic" : "Turn on mic"}
        >
          {micEnabled ? (
            <Mic className="w-7 h-7" />
          ) : (
            <MicOff className="w-7 h-7" />
          )}
          <span>{micEnabled ? "Mic On" : "Mic Off"}</span>
        </Button>

        {/* Status indicator dot */}
        <div
          className={`absolute top-1 right-1 w-3 h-3 rounded-full transition-all ${
            isSpeaking
              ? "bg-red-500 animate-pulse"
              : isListening
                ? "bg-green-500 animate-pulse"
                : "bg-gray-400"
          }`}
        />
      </div>

      {/* Helper text */}
      <div className="mt-3 text-center text-xs text-gray-600 dark:text-gray-400 max-w-24">
        {isSpeaking && "Bot speaking..."}
        {!isSpeaking && isListening && "Listening..."}
        {!isListening && !isSpeaking && "Mic ready"}
      </div>
    </div>
  );
}
