import { useState } from "react";
import { useVoiceController } from "@/context/VoiceController";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/use-speech";

export function MicrophoneControl() {
  const { setAlwaysListening, start, stop, state } = useVoiceController();
  const [always, setAlways] = useState(false);

  return (
    <div className="fixed bottom-20 right-4 z-50 flex items-center gap-3">
      {/* Push-to-talk */}
      <Button
        variant="secondary"
        size="icon"
        className="rounded-full w-12 h-12"
        onMouseDown={() => start()}
        onMouseUp={() => stop()}
        onTouchStart={() => start()}
        onTouchEnd={() => stop()}
        aria-label="Push to talk"
      >
        <Mic className="w-5 h-5" />
      </Button>

      <Button
        variant={always ? "secondary" : "outline"}
        className="rounded-full"
        onClick={() => {
          const next = !always;
          setAlways(next);
          setAlwaysListening(next);
          setAlways(next);
        }}
        aria-label={always ? "Disable Always Listening" : "Enable Always Listening"}
      >
        {always ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        <span className="ml-2 text-sm">{always ? "Listening" : "Push-to-talk"}</span>
      </Button>
    </div>
  );
}
