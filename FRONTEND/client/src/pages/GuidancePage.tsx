import { Button } from "@/components/ui/button";
import { ArrowLeft, Navigation, AlertTriangle, User, Check, Loader2, Gamepad2 } from "lucide-react";
import { Link } from "wouter";
import { useVoiceController } from "@/context/VoiceController";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GamepadController, { type ControlMode } from "@/components/GamepadController";
import { speak } from "@/lib/tts";

/* ─── Types matching GET /api/status response ─── */
type RobotStatus = {
  mode: "IDLE" | "GUIDE";
  destination: string | null;
  pipeline_healthy: boolean;
  nav_state: string;
  intent: string;
  person_detected: boolean;
  person_zone: string;
  confidence: number;
  nav_obstacles: number;
  nav_paths: number;
};

export default function GuidancePage({ params }: { params: { id: string } }) {
  const { destination } = useVoiceController();
  const [status, setStatus] = useState<RobotStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const [completed, setCompleted] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── PS5 DualSense controller state ──
  const [controlMode, setControlMode] = useState<ControlMode>("autonomous");
  const [controllerConnected, setControllerConnected] = useState(false);
  const [lastGamepadCmd, setLastGamepadCmd] = useState<string>("STOP");
  const [modeOverlay, setModeOverlay] = useState<ControlMode | null>(null);
  const modeOverlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const locationConfig: Record<string, { name: string; icon: string; color: string }> = {
    FEE: { name: "Fee Payment Counter", icon: "💰", color: "from-amber-500 to-orange-600" },
    ADMISSION: { name: "Admissions Office", icon: "📝", color: "from-blue-500 to-indigo-600" },
    ADMIN: { name: "Admin Block", icon: "🏢", color: "from-slate-500 to-slate-700" },
    LIBRARY: { name: "Central Library", icon: "📚", color: "from-purple-500 to-pink-600" },
    EXAM: { name: "Exam Cell", icon: "🧑‍💼", color: "from-red-500 to-rose-600" },
    CANTEEN: { name: "Canteen & Food Court", icon: "🍽", color: "from-green-500 to-emerald-600" },
    A_BLOCK: { name: "A Block", icon: "🏫", color: "from-teal-500 to-cyan-600" },
    B_BLOCK: { name: "B Block", icon: "🏫", color: "from-indigo-500 to-violet-600" },
    C_BLOCK: { name: "C Block", icon: "🏫", color: "from-rose-500 to-pink-600" },
  };

  const locId = destination || params.id;
  const config = locationConfig[locId] || { name: locId, icon: "📍", color: "from-primary to-primary" };

  /* ─── Poll /api/status every 500ms ─── */
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/status");
        if (res.ok) {
          const json = await res.json();
          const data: RobotStatus = json.data || json;
          setStatus(data);
          setConnected(true);

          if (data.nav_state === "ARRIVED") {
            setCompleted(true);
          }
        } else {
          setConnected(false);
        }
      } catch {
        setConnected(false);
      }
    };

    // Immediate first poll
    void poll();
    pollRef.current = setInterval(poll, 500);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  /* ─── Stop mission on unmount (leaving page = cancel) ─── */
  useEffect(() => {
    return () => {
      if (!completed) {
        fetch("/api/stop", { method: "POST" }).catch(() => {});
      }
    };
  }, [completed]);

  /* ─── Helper: readable nav state label ─── */
  const navStateLabel = (s: string) => {
    const labels: Record<string, string> = {
      IDLE: "Waiting",
      SEARCH_PATH: "Searching for path…",
      ALIGN_PATH: "Aligning to path…",
      FORWARD: "Moving forward",
      AVOID_OBSTACLE: "Avoiding obstacle…",
      ARRIVED: "Arrived! 🎉",
      EMERGENCY_STOP: "⚠️ Emergency Stop",
    };
    return labels[s] || s;
  };

  /* ─── Nav state color ─── */
  const navStateColor = (s: string) => {
    if (s === "FORWARD") return "text-green-400";
    if (s === "ARRIVED") return "text-emerald-400";
    if (s === "EMERGENCY_STOP") return "text-red-400";
    if (s === "AVOID_OBSTACLE") return "text-yellow-400";
    return "text-cyan-400";
  };

  /* ─── Gamepad mode change handler ─── */
  const handleModeChange = useCallback((newMode: ControlMode) => {
    setControlMode(newMode);

    // Show overlay briefly
    setModeOverlay(newMode);
    if (modeOverlayTimer.current) clearTimeout(modeOverlayTimer.current);
    modeOverlayTimer.current = setTimeout(() => setModeOverlay(null), 1500);

    // Notify Python server
    fetch("/api/manual/mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: newMode }),
    }).catch(() => {});

    // Voice announcement
    const labels: Record<ControlMode, string> = {
      manual: "Manual mode. Gamepad has full control.",
      assisted: "Assisted mode. Gamepad drives with safety override.",
      autonomous: "Autonomous mode. GUIDO is self-driving.",
    };
    void speak(labels[newMode]);
  }, []);

  /* ─── Gamepad command sent callback ─── */
  const handleCommandSent = useCallback((command: string) => {
    setLastGamepadCmd(command);
  }, []);

  /* ─── Mode label + colors ─── */
  const modeInfo: Record<ControlMode, { label: string; color: string; bg: string }> = {
    autonomous: { label: "🤖 Autonomous", color: "text-cyan-300", bg: "bg-cyan-500/20 border-cyan-500/40" },
    assisted:   { label: "🛡️ Assisted",   color: "text-amber-300", bg: "bg-amber-500/20 border-amber-500/40" },
    manual:     { label: "🎮 Manual",     color: "text-purple-300", bg: "bg-purple-500/20 border-purple-500/40" },
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden relative">
      {/* ── PS5 DualSense Gamepad Controller (invisible) ── */}
      <GamepadController
        mode={controlMode}
        onModeChange={handleModeChange}
        onControllerConnected={setControllerConnected}
        onCommandSent={handleCommandSent}
      />

      {/* Animated background elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className={`absolute top-0 right-0 w-96 h-96 bg-gradient-to-r ${config.color} rounded-full mix-blend-screen blur-3xl opacity-20 animate-pulse`} />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full mix-blend-screen blur-3xl opacity-20 animate-pulse" />
      </div>

      {/* Header */}
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative z-20 px-6 py-4 flex items-center gap-4 border-b border-white/10 backdrop-blur-xl bg-slate-900/50"
      >
        <Link href="/visitor">
          <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/10 text-white h-10 w-10">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-1">
            {config.icon} {config.name}
          </h1>
          <div className="flex items-center gap-2 text-xs">
            <span className={`inline-block w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-red-400"}`} />
            <span className={connected ? "text-green-300" : "text-red-300"}>
              {connected ? "Robot Connected" : "Connecting…"}
            </span>
          </div>
        </div>
      </motion.div>

      {/* ── Controller Status Bar ── */}
      {controllerConnected && (
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`relative z-20 px-6 py-2 flex items-center justify-between border-b ${modeInfo[controlMode].bg}`}
        >
          <div className="flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-purple-300" />
            <span className={`text-sm font-bold ${modeInfo[controlMode].color}`}>
              {modeInfo[controlMode].label}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            {controlMode !== "autonomous" && (
              <span className="font-mono">{lastGamepadCmd}</span>
            )}
            <span className="text-green-400">● Connected</span>
          </div>
        </motion.div>
      )}

      {/* Main Content */}
      <main className="relative z-10 px-6 pt-8 pb-32 max-w-2xl mx-auto">
        {/* Live Status Circle */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center mb-10"
        >
          <div className="relative w-40 h-40">
            {/* Rotating ring when moving */}
            {status?.nav_state === "FORWARD" && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="absolute -inset-2 border-2 border-dashed border-green-400/40 rounded-full"
              />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 rounded-full">
              {!status ? (
                <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
              ) : (
                <>
                  <Navigation className={`w-10 h-10 mb-2 ${navStateColor(status.nav_state)}`} />
                  <span className={`text-sm font-bold ${navStateColor(status.nav_state)}`}>
                    {navStateLabel(status.nav_state)}
                  </span>
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* Live Telemetry Cards */}
        {status && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-2 gap-4 mb-8"
          >
            {/* Person Detection */}
            <div className={`rounded-2xl p-4 border ${status.person_detected ? "bg-yellow-500/10 border-yellow-500/30" : "bg-white/5 border-white/10"}`}>
              <div className="flex items-center gap-2 mb-1">
                <User className={`w-4 h-4 ${status.person_detected ? "text-yellow-400" : "text-gray-500"}`} />
                <span className="text-xs font-semibold text-gray-400">Person</span>
              </div>
              <p className={`text-lg font-bold ${status.person_detected ? "text-yellow-300" : "text-gray-500"}`}>
                {status.person_detected ? status.person_zone : "Clear"}
              </p>
            </div>

            {/* Intent */}
            <div className="rounded-2xl p-4 bg-white/5 border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <Navigation className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold text-gray-400">Intent</span>
              </div>
              <p className="text-lg font-bold text-cyan-300">{status.intent}</p>
            </div>

            {/* Confidence */}
            <div className="rounded-2xl p-4 bg-white/5 border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-gray-400">Confidence</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                    animate={{ width: `${(status.confidence * 100).toFixed(0)}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <span className="text-sm font-bold text-cyan-300">
                  {(status.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Pipeline Health */}
            <div className={`rounded-2xl p-4 border ${status.pipeline_healthy ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"}`}>
              <div className="flex items-center gap-2 mb-1">
                {status.pipeline_healthy ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                )}
                <span className="text-xs font-semibold text-gray-400">Pipeline</span>
              </div>
              <p className={`text-lg font-bold ${status.pipeline_healthy ? "text-green-300" : "text-red-300"}`}>
                {status.pipeline_healthy ? "Healthy" : "Error"}
              </p>
            </div>
          </motion.div>
        )}

        {/* Emergency Stop Info */}
        {status?.nav_state === "EMERGENCY_STOP" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 p-4 bg-red-500/20 border border-red-500/40 rounded-2xl text-center"
          >
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-red-300 font-bold">Emergency Stop Active</p>
            <p className="text-red-300/70 text-sm mt-1">The robot has stopped for safety. Clear the obstruction or press stop to cancel.</p>
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent"
        >
          <div className="max-w-2xl mx-auto space-y-2">
            <Link href="/perception">
              <Button
                size="lg"
                variant="outline"
                className="w-full rounded-xl h-12 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 hover:border-cyan-500/60 font-semibold"
              >
                👁️ View Live Detections & Camera Feed
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="w-full rounded-xl h-14 border-red-500/40 text-red-300 hover:bg-red-500/10 hover:border-red-500/60 font-bold"
              onClick={async () => {
                try {
                  await fetch("/api/stop", { method: "POST" });
                } catch {}
              }}
            >
              🛑 Stop Robot
            </Button>
          </div>
        </motion.div>
      </main>

      {/* ── Mode Change Overlay (Step 6) ── */}
      <AnimatePresence>
        {modeOverlay && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none"
          >
            <div className={`px-10 py-8 rounded-3xl backdrop-blur-xl border shadow-2xl ${modeInfo[modeOverlay].bg}`}>
              <p className={`text-4xl font-black text-center ${modeInfo[modeOverlay].color}`}>
                {modeInfo[modeOverlay].label}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Arrival Celebration */}
      <AnimatePresence>
        {completed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0, rotateZ: -180 }}
              animate={{ scale: 1, rotateZ: 0 }}
              exit={{ scale: 0, rotateZ: 180 }}
              transition={{ type: "spring", stiffness: 100, damping: 10 }}
              className="text-center"
            >
              {/* Celebration particles */}
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-3 h-3 bg-cyan-400 rounded-full"
                  initial={{ x: 0, y: 0, opacity: 1 }}
                  animate={{
                    x: (Math.random() - 0.5) * 200,
                    y: (Math.random() - 0.5) * 200,
                    opacity: 0,
                  }}
                  transition={{ duration: 2, ease: "easeOut" }}
                />
              ))}

              {/* Main celebration card */}
              <motion.div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl p-12 shadow-2xl max-w-sm mx-auto">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                  className="text-8xl mb-6 drop-shadow-lg"
                >
                  🎉
                </motion.div>
                <h2 className="text-4xl font-bold text-white mb-3">You've Arrived!</h2>
                <p className="text-xl text-green-50 mb-8">{config.name}</p>
                <p className="text-sm text-green-100 mb-8 font-semibold">
                  ✓ Guidance Complete • Navigation Successful
                </p>
                <Link href="/visitor" className="block">
                  <Button
                    size="lg"
                    className="w-full rounded-xl h-14 bg-white text-green-600 hover:bg-gray-100 font-bold"
                  >
                    New Destination
                  </Button>
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
