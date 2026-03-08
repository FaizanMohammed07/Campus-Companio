import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import {
  ArrowLeft, RefreshCw, CheckCircle, XCircle, AlertTriangle,
  Eye, Camera, Cpu, Wifi, Zap, Shield, Navigation, User,
  Activity, Radio, ArrowRight, ChevronDown, ChevronUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Perception – Full YOLO Detection Dashboard + Command Pipeline Monitor.
 *
 * Shows:
 *  1. Live annotated camera feed (YOLO boxes drawn by Python)
 *  2. Person model detections list
 *  3. Navigation model detections list
 *  4. Current ESP32 command + pipeline flow diagram
 *  5. System health & event log
 *
 * This page does NOT send any motor commands.
 * All navigation authority lives in the Python Vision Server.
 */

// ── Types ─────────────────────────────────────────────

type Detection = {
  class: string;
  x1: number; y1: number; x2: number; y2: number;
  confidence: number;
  cx_norm?: number;
  area_ratio?: number;
};

type DetailedStatus = {
  mode: "IDLE" | "GUIDE";
  destination: string | null;
  pipeline_healthy: boolean;
  // Person model
  person_detected: boolean;
  person_ratio: number;
  person_zone: string;
  confidence: number;
  person_detections: Detection[];
  // Nav model
  nav_state: string;
  intent: string;
  nav_obstacles_count: number;
  nav_paths_count: number;
  nav_a_blocks_count: number;
  nav_b_blocks_count: number;
  nav_c_blocks_count: number;
  nav_detections: Detection[];
  // Pipeline
  running: boolean;
  frame_age_s: number;
  inference_failures: number;
  // Annotated frame
  annotated_frame: string | null;
  // Error fallback
  error?: string;
};

// ── Helpers ───────────────────────────────────────────

const intentColor = (i: string) => {
  const m: Record<string, string> = {
    STOP: "text-red-400", CRUISE: "text-green-400",
    PREFER_LEFT: "text-orange-400", PREFER_RIGHT: "text-orange-400",
    LEFT: "text-yellow-400", RIGHT: "text-yellow-400", BACK: "text-purple-400",
  };
  return m[i] || "text-gray-400";
};

const intentBg = (i: string) => {
  const m: Record<string, string> = {
    STOP: "bg-red-500/20 border-red-500/40",
    CRUISE: "bg-green-500/20 border-green-500/40",
    PREFER_LEFT: "bg-orange-500/20 border-orange-500/40",
    PREFER_RIGHT: "bg-orange-500/20 border-orange-500/40",
    LEFT: "bg-yellow-500/20 border-yellow-500/40",
    RIGHT: "bg-yellow-500/20 border-yellow-500/40",
    BACK: "bg-purple-500/20 border-purple-500/40",
  };
  return m[i] || "bg-gray-500/20 border-gray-500/40";
};

const navStateColor = (s: string) => {
  const m: Record<string, string> = {
    IDLE: "bg-gray-500", SEARCH_PATH: "bg-blue-500", ALIGN_PATH: "bg-cyan-500",
    FORWARD: "bg-green-500", AVOID_OBSTACLE: "bg-yellow-500",
    ARRIVED: "bg-emerald-500", EMERGENCY_STOP: "bg-red-500",
  };
  return m[s] || "bg-gray-500";
};

const detClassColor = (c: string) => {
  const m: Record<string, string> = {
    person: "text-red-400 bg-red-500/10 border-red-500/30",
    obstacle: "text-red-400 bg-red-500/10 border-red-500/30",
    path: "text-green-400 bg-green-500/10 border-green-500/30",
    a_block: "text-orange-400 bg-orange-500/10 border-orange-500/30",
    b_block: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
    c_block: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  };
  return m[c] || "text-gray-400 bg-gray-500/10 border-gray-500/30";
};

// ── Component ─────────────────────────────────────────

export default function Perception() {
  const [status, setStatus] = useState<DetailedStatus | null>(null);
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [polling, setPolling] = useState(true);
  const [history, setHistory] = useState<string[]>([]);
  const [showDetections, setShowDetections] = useState(true);
  const [showPipeline, setShowPipeline] = useState(true);
  const [fps, setFps] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fpsRef = useRef({ count: 0, lastTime: Date.now() });

  /* ─── Poll /api/detailed-status at ~3 Hz ─── */
  useEffect(() => {
    if (!polling) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    const poll = async () => {
      try {
        const res = await fetch("/api/detailed-status");
        if (res.ok) {
          const json = await res.json();
          const data: DetailedStatus = json.data || json;
          setStatus(data);
          setHealthy(data.pipeline_healthy);

          // FPS counter
          fpsRef.current.count++;
          const now = Date.now();
          if (now - fpsRef.current.lastTime >= 1000) {
            setFps(fpsRef.current.count);
            fpsRef.current.count = 0;
            fpsRef.current.lastTime = now;
          }

          // History log
          setHistory((prev) => {
            const entry = `${new Date().toLocaleTimeString()} | ${data.nav_state} | ${data.intent} | person=${data.person_detected} | det=${(data.nav_detections || []).length}`;
            return [entry, ...prev].slice(0, 80);
          });
        } else {
          setHealthy(false);
        }
      } catch {
        setHealthy(false);
      }
    };

    void poll();
    pollRef.current = setInterval(poll, 333); // ~3 Hz

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [polling]);

  const allDetections = [
    ...(status?.person_detections || []),
    ...(status?.nav_detections || []),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* ─── Header ─── */}
      <div className="sticky top-0 z-30 px-4 py-3 border-b border-white/10 backdrop-blur-xl bg-slate-950/80">
        <div className="flex items-center gap-3 max-w-6xl mx-auto">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 text-white hover:bg-white/10">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Eye className="w-5 h-5 text-cyan-400" /> Detection Dashboard
            </h1>
            <p className="text-[10px] text-gray-400">Live YOLO detection feed • Read-only monitor</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-mono">{fps} fps</span>
            <Button
              variant={polling ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setPolling((p) => !p)}
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${polling ? "animate-spin" : ""}`} />
              {polling ? "Live" : "Paused"}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">

        {/* ─── System Health Bar ─── */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Connection */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
            {healthy === null ? (
              <Radio className="w-3 h-3 text-gray-400 animate-pulse" />
            ) : healthy ? (
              <CheckCircle className="w-3 h-3 text-green-400" />
            ) : (
              <XCircle className="w-3 h-3 text-red-400" />
            )}
            <span className="text-[11px] font-medium">
              {healthy === null ? "Connecting…" : healthy ? "Connected" : "Disconnected"}
            </span>
          </div>
          {/* Pipeline */}
          {status && (
            <>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                <Activity className={`w-3 h-3 ${status.running ? "text-green-400" : "text-red-400"}`} />
                <span className="text-[11px]">Pipeline {status.running ? "Running" : "Stopped"}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                <Cpu className="w-3 h-3 text-cyan-400" />
                <span className="text-[11px]">Frame age: {status.frame_age_s}s</span>
              </div>
              {status.inference_failures > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30">
                  <AlertTriangle className="w-3 h-3 text-red-400" />
                  <span className="text-[11px] text-red-400">Failures: {status.inference_failures}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* ─── Main 2-Column Layout ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* ─── LEFT: Camera Feed (3 cols) ─── */}
          <div className="lg:col-span-3 space-y-4">
            {/* Annotated Camera Frame */}
            <Card className="bg-black/40 border-white/10 overflow-hidden">
              <div className="p-3 border-b border-white/10 flex items-center gap-2">
                <Camera className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-semibold">Live Camera — YOLO Overlay</span>
                <span className="ml-auto text-[10px] text-gray-500">
                  Person YOLO (yolov8n) + Nav YOLO (best.pt)
                </span>
              </div>
              <div className="relative aspect-video bg-black flex items-center justify-center">
                {status?.annotated_frame ? (
                  <img
                    src={`data:image/jpeg;base64,${status.annotated_frame}`}
                    alt="Annotated camera feed"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-gray-600 text-sm flex flex-col items-center gap-2">
                    <Camera className="w-10 h-10" />
                    <span>{healthy === false ? "Vision server offline" : "Waiting for camera…"}</span>
                  </div>
                )}
                {/* Intent overlay badge */}
                {status && (
                  <div className={`absolute top-3 right-3 px-3 py-1.5 rounded-lg border font-mono text-sm font-bold ${intentBg(status.intent)}`}>
                    <span className={intentColor(status.intent)}>⚡ {status.intent}</span>
                  </div>
                )}
              </div>
            </Card>

            {/* ─── Command Pipeline Flow ─── */}
            <Card className="bg-black/40 border-white/10">
              <button
                className="w-full p-3 flex items-center gap-2 text-left"
                onClick={() => setShowPipeline(!showPipeline)}
              >
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-semibold flex-1">Command Pipeline — How It Works</span>
                {showPipeline ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <AnimatePresence>
                {showPipeline && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-4">
                      {/* Architecture Flow */}
                      <div className="flex items-center gap-2 flex-wrap text-xs mb-4">
                        {[
                          { icon: <Camera className="w-3 h-3" />, label: "Camera", sub: "OpenCV" },
                          { icon: <Eye className="w-3 h-3" />, label: "Person YOLO", sub: "yolov8n.pt" },
                          { icon: <Navigation className="w-3 h-3" />, label: "Nav YOLO", sub: "best.pt" },
                          { icon: <Cpu className="w-3 h-3" />, label: "Fusion", sub: "Person > Nav" },
                          { icon: <Wifi className="w-3 h-3" />, label: "ESP32", sub: "WiFi poll" },
                        ].map((step, i) => (
                          <div key={step.label} className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10">
                              {step.icon}
                              <div>
                                <div className="font-semibold">{step.label}</div>
                                <div className="text-[9px] text-gray-500">{step.sub}</div>
                              </div>
                            </div>
                            {i < 4 && <ArrowRight className="w-3 h-3 text-gray-600" />}
                          </div>
                        ))}
                      </div>

                      {/* Live data flow */}
                      {status && (
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          {/* Step 1: Person Detection */}
                          <div className="rounded-lg p-2.5 bg-white/5 border border-white/10">
                            <div className="flex items-center gap-1 mb-1.5">
                              <User className="w-3 h-3 text-red-400" />
                              <span className="font-semibold">Person Model</span>
                            </div>
                            <div className="space-y-0.5 text-[11px] text-gray-400">
                              <p>Detected: <span className={status.person_detected ? "text-yellow-400 font-bold" : "text-green-400"}>{status.person_detected ? "YES" : "No"}</span></p>
                              <p>Zone: <span className="text-white">{status.person_zone}</span></p>
                              <p>Ratio: <span className="text-white">{(status.person_ratio * 100).toFixed(1)}%</span></p>
                              <p>Conf: <span className="text-white">{(status.confidence * 100).toFixed(0)}%</span></p>
                            </div>
                          </div>
                          {/* Step 2: Nav Detection */}
                          <div className="rounded-lg p-2.5 bg-white/5 border border-white/10">
                            <div className="flex items-center gap-1 mb-1.5">
                              <Navigation className="w-3 h-3 text-cyan-400" />
                              <span className="font-semibold">Nav Model</span>
                            </div>
                            <div className="space-y-0.5 text-[11px] text-gray-400">
                              <p>State: <span className="text-white">{status.nav_state}</span></p>
                              <p>Dest: <span className="text-white">{status.destination || "—"}</span></p>
                              <p>Obstacles: <span className="text-red-400 font-bold">{status.nav_obstacles_count}</span></p>
                              <p>Paths: <span className="text-green-400 font-bold">{status.nav_paths_count}</span></p>
                              <p>Blocks: <span className="text-yellow-400">{status.nav_a_blocks_count + status.nav_b_blocks_count + status.nav_c_blocks_count}</span></p>
                            </div>
                          </div>
                          {/* Step 3: Fusion Output */}
                          <div className={`rounded-lg p-2.5 border ${intentBg(status.intent)}`}>
                            <div className="flex items-center gap-1 mb-1.5">
                              <Zap className="w-3 h-3 text-yellow-400" />
                              <span className="font-semibold">→ ESP32 Command</span>
                            </div>
                            <div className="space-y-1">
                              <p className={`text-2xl font-black ${intentColor(status.intent)}`}>
                                {status.intent}
                              </p>
                              <p className="text-[10px] text-gray-500">
                                {status.person_detected
                                  ? "⚠️ Person override active"
                                  : status.nav_state === "IDLE"
                                    ? "💤 No mission"
                                    : "🧭 Nav model driving"}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </div>

          {/* ─── RIGHT: Detection Details (2 cols) ─── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Status Cards Grid */}
            {status && (
              <div className="grid grid-cols-2 gap-2">
                <Card className="bg-black/40 border-white/10 p-3">
                  <p className="text-[10px] text-gray-500 mb-0.5">Nav State</p>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${navStateColor(status.nav_state)}`} />
                    <span className="font-bold text-sm">{status.nav_state}</span>
                  </div>
                </Card>
                <Card className="bg-black/40 border-white/10 p-3">
                  <p className="text-[10px] text-gray-500 mb-0.5">Mission</p>
                  <span className="font-bold text-sm">{status.mode}</span>
                  {status.destination && (
                    <span className="ml-1 text-[10px] text-cyan-400">→ {status.destination}</span>
                  )}
                </Card>
                <Card className={`p-3 border ${status.person_detected ? "bg-yellow-500/10 border-yellow-500/30" : "bg-black/40 border-white/10"}`}>
                  <p className="text-[10px] text-gray-500 mb-0.5">Person</p>
                  <span className={`font-bold text-sm ${status.person_detected ? "text-yellow-400" : "text-green-400"}`}>
                    {status.person_detected ? `⚠ ${status.person_zone}` : "✓ Clear"}
                  </span>
                </Card>
                <Card className={`p-3 border ${intentBg(status.intent)}`}>
                  <p className="text-[10px] text-gray-500 mb-0.5">Command → ESP32</p>
                  <span className={`font-bold text-sm ${intentColor(status.intent)}`}>{status.intent}</span>
                </Card>
              </div>
            )}

            {/* ─── All Detections List ─── */}
            <Card className="bg-black/40 border-white/10">
              <button
                className="w-full p-3 flex items-center gap-2 text-left"
                onClick={() => setShowDetections(!showDetections)}
              >
                <Shield className="w-4 h-4 text-green-400" />
                <span className="text-sm font-semibold flex-1">
                  All Detections ({allDetections.length})
                </span>
                {showDetections ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <AnimatePresence>
                {showDetections && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 max-h-64 overflow-auto space-y-1.5">
                      {allDetections.length === 0 ? (
                        <p className="text-xs text-gray-600 py-2 text-center">No detections</p>
                      ) : (
                        allDetections.map((det, i) => (
                          <div
                            key={`det-${det.class}-${i}`}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${detClassColor(det.class)}`}
                          >
                            <span className="font-bold uppercase w-16 truncate">{det.class}</span>
                            <span className="font-mono text-[10px] text-gray-400 flex-1">
                              [{det.x1},{det.y1}]-[{det.x2},{det.y2}]
                            </span>
                            <span className="font-mono font-bold">
                              {(det.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>

            {/* ─── Nav Detection Breakdown ─── */}
            {status && (
              <Card className="bg-black/40 border-white/10 p-3">
                <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-cyan-400" />
                  Nav Model Breakdown
                </p>
                <div className="grid grid-cols-5 gap-1 text-center">
                  {[
                    { label: "OBS", count: status.nav_obstacles_count, color: "text-red-400" },
                    { label: "PATH", count: status.nav_paths_count, color: "text-green-400" },
                    { label: "A", count: status.nav_a_blocks_count, color: "text-orange-400" },
                    { label: "B", count: status.nav_b_blocks_count, color: "text-yellow-400" },
                    { label: "C", count: status.nav_c_blocks_count, color: "text-blue-400" },
                  ].map((b) => (
                    <div key={b.label} className="rounded-lg bg-white/5 py-1.5">
                      <p className={`text-xl font-black ${b.color}`}>{b.count}</p>
                      <p className="text-[9px] text-gray-500">{b.label}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* ─── Event Log ─── */}
            <Card className="bg-black/40 border-white/10">
              <div className="p-3 flex items-center justify-between border-b border-white/5">
                <span className="text-xs font-semibold flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-gray-400" />
                  Event Log
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] text-gray-500 hover:text-white"
                  onClick={() => setHistory([])}
                >
                  Clear
                </Button>
              </div>
              <div className="max-h-40 overflow-auto p-2 font-mono text-[9px] space-y-px">
                {history.length === 0 ? (
                  <p className="text-gray-600 text-center py-2">Waiting for data…</p>
                ) : (
                  history.map((entry, i) => (
                    <div key={`log-${i}`} className="text-gray-500 hover:text-gray-300 transition-colors">
                      {entry}
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* ─── Footer ─── */}
        <p className="text-[10px] text-center text-gray-600 py-2">
          🔒 Read-only monitor — All movement decisions made by Python Vision Server → ESP32
        </p>
      </div>
    </div>
  );
}
