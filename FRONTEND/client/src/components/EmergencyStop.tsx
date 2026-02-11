import { OctagonAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmergencyStop() {
  const handleEmergencyStop = () => {
    alert("EMERGENCY STOP ACTIVATED");
  };

  return (
    <Button
      variant="destructive"
      size="lg"
      className="fixed top-12 right-4 z-50 rounded-full w-14 h-14 p-0 shadow-xl border-4 border-white/20 hover:scale-105 transition-transform"
      onClick={handleEmergencyStop}
      data-testid="button-emergency-stop"
      aria-label="Emergency Stop"
    >
      <OctagonAlert className="w-8 h-8" />
    </Button>
  );
}
