import { Wifi, Battery, Signal } from "lucide-react";
import { useEffect, useState } from "react";

export function StatusBar() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full h-8 bg-background/80 backdrop-blur-md fixed top-0 left-0 z-50 flex items-center justify-between px-6 border-b border-border/50 text-xs font-medium text-muted-foreground">
      <div className="flex items-center gap-2">
        <span>CampusBot v2.4</span>
      </div>
      
      <div className="flex items-center gap-4">
        <span>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <div className="flex items-center gap-1">
          <Signal className="w-4 h-4" />
          <Wifi className="w-4 h-4" />
          <Battery className="w-4 h-4" />
          <span className="text-[10px]">85%</span>
        </div>
      </div>
    </div>
  );
}
