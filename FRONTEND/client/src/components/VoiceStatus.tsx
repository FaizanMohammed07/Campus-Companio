import { motion } from "framer-motion";

type VoiceState = "idle" | "listening" | "processing" | "speaking";

interface VoiceStatusProps {
  state?: VoiceState;
  text?: string;
  ttsMode?: "elevenlabs" | "fallback" | "unknown";
}

export function VoiceStatus({ state = "idle", text, ttsMode }: VoiceStatusProps) {
  if (state === "idle" && !text) return null;

  const colors = {
    idle: "bg-muted",
    listening: "bg-primary",
    processing: "bg-yellow-400",
    speaking: "bg-green-400",
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-4 pointer-events-none"
    >
      <div className="bg-background/90 backdrop-blur-lg border border-primary/10 rounded-full py-3 px-6 shadow-xl flex items-center gap-4 min-h-[60px]">
        {/* Visual Indicator */}
        <div className="flex items-center gap-1 h-8 min-w-[32px]">
            {[1, 2, 3, 4].map((i) => (
                <motion.div
                    key={i}
                    className={`w-1.5 rounded-full ${colors[state]}`}
                    animate={{
                        height: state === "listening" || state === "speaking" ? [10, 24, 10] : 8,
                    }}
                    transition={{
                        repeat: Infinity,
                        duration: 0.8,
                        delay: i * 0.1,
                    }}
                />
            ))}
        </div>
        
        {/* Caption */}
        <div className="flex-1">
            <p className="text-lg font-medium text-foreground leading-tight">
                {text || (state === "listening" ? "Listening..." : "Ready")}
            </p>
            {ttsMode === "fallback" && state === "speaking" && (
              <p className="text-xs text-amber-400 leading-tight mt-0.5">
                ⚠️ Device voice — ElevenLabs unavailable
              </p>
            )}
        </div>
      </div>
    </motion.div>
  );
}
