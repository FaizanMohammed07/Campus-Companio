import { motion } from "framer-motion";
import { Camera } from "lucide-react";
import { useState, useEffect } from "react";

export function CameraPreview() {
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    // Simulate camera permission request
    const timer = setTimeout(() => {
      setHasPermission(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed bottom-4 left-4 w-32 h-24 bg-black rounded-lg overflow-hidden border-2 border-primary/20 shadow-lg z-40 hidden md:flex items-center justify-center group"
    >
      {hasPermission ? (
        <div className="w-full h-full bg-slate-800 relative">
          <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs">
            [Camera Feed]
          </div>
          {/* Overlay scanning lines */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/10 to-transparent opacity-20 animate-scan" />
        </div>
      ) : (
        <div className="flex flex-col items-center text-slate-500">
            <Camera className="w-6 h-6 mb-1 opacity-50" />
            <span className="text-[10px]">Initializing...</span>
        </div>
      )}
    </motion.div>
  );
}
