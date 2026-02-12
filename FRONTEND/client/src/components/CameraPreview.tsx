import { motion } from "framer-motion";
import { Camera } from "lucide-react";
import { useState, useEffect, useRef } from "react";

export function CameraPreview() {
  const [hasPermission, setHasPermission] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    async function enableCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        setError("Camera access denied or unavailable");
      }
    }
    enableCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed bottom-4 left-4 w-32 h-24 bg-black rounded-lg overflow-hidden border-2 border-primary/20 shadow-lg z-40 flex items-center justify-center group"
      style={{ touchAction: "none" }}
    >
      {hasPermission ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center text-slate-500">
          <Camera className="w-6 h-6 mb-1 opacity-50" />
          <span className="text-[10px]">Initializing...</span>
        </div>
      )}
    </motion.div>
  );
}
