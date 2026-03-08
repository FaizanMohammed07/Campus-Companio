import { OctagonAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function EmergencyStop() {
  const [stopping, setStopping] = useState(false);

  const handleEmergencyStop = async () => {
    setStopping(true);
    try {
      await fetch("/api/stop", { method: "POST" });
    } catch {
      // Even if the network call fails, ESP32 watchdog will stop the robot
    } finally {
      setStopping(false);
    }
  };

  return (
    <Button
      variant="destructive"
      size="lg"
      className={`fixed top-12 right-4 z-50 rounded-full w-14 h-14 p-0 shadow-xl border-4 border-white/20 hover:scale-105 transition-transform ${stopping ? "animate-pulse opacity-70" : ""}`}
      onClick={handleEmergencyStop}
      disabled={stopping}
      data-testid="button-emergency-stop"
      aria-label="Emergency Stop"
    >
      <OctagonAlert className="w-8 h-8" />
    </Button>
  );
}
