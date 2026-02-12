import { useEffect, useRef, useState } from "react";
import * as ort from "onnxruntime-web";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

// Model configuration
const MODEL_URL = "/models/best.onnx"; // exported from your trained weights
const CLASSES_URL = "/models/classes.json"; // names from data.yaml
const INPUT_SIZE = 320; // small for mobile performance
const SCORE_THRESHOLD = 0.35;
const NMS_IOU_THRESHOLD = 0.45;
const COMMAND_FREQ_MS = 150; // ~6-7 Hz

// Classes of interest (subset)
const TARGET_CLASSES = ["person", "chair", "bench", "backpack", "umbrella"];

type SymbolicAction =
  | "FORWARD"
  | "LEFT"
  | "RIGHT"
  | "STOP"
  | "ROTATE_LEFT"
  | "ROTATE_RIGHT";
type Command = {
  action: SymbolicAction;
  confidence: number;
  reason: "FREE_PATH" | "PERSON" | "OBSTACLE";
  timestamp: number;
};

type WireCommand = {
  action: SymbolicAction;
  confidence: number;
  timestamp: number;
};

function zoneFromX(x: number, width: number) {
  const third = width / 3;
  if (x < third) return "LEFT";
  if (x < third * 2) return "CENTER";
  return "RIGHT";
}

export default function Perception() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [running, setRunning] = useState(false);
  const [session, setSession] = useState<ort.InferenceSession | null>(null);
  const { toast } = useToast();
  const [lastCommand, setLastCommand] = useState<Command | null>(null);
  const [classMap, setClassMap] = useState<string[] | null>(null);
  const [espEndpoint, setEspEndpoint] = useState<string>("/api/drive/command");

  // Camera init
  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (e) {
        toast({
          title: "Camera error",
          description: "Camera feed failed. STOP issued.",
          variant: "destructive",
        });
        issueStop("CameraFailure");
      }
    })();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Load class names and model
  useEffect(() => {
    (async () => {
      try {
        // Load class names
        const resp = await fetch(CLASSES_URL);
        if (resp.ok) {
          const names = await resp.json();
          if (Array.isArray(names)) setClassMap(names as string[]);
        }
      } catch {}

      try {
        // Ensure wasm assets resolve on mobile; fall back to CDN
        (ort.env as any).wasm = (ort.env as any).wasm || {};
        (ort.env as any).wasm.wasmPaths =
          (ort as any).wasm?.wasmPaths ||
          "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.0/dist/";
        const s = await ort.InferenceSession.create(MODEL_URL, {
          executionProviders: ["wasm"],
          graphOptimizationLevel: "all",
        });
        setSession(s);
      } catch (e) {
        toast({
          title: "Model error",
          description: "Inference init failed. STOP issued.",
          variant: "destructive",
        });
        issueStop("ModelInitFailure");
      }
    })();
  }, []);

  function issueStop(reason: string) {
    const cmd: Command = {
      action: "STOP",
      confidence: 1.0,
      reason: "OBSTACLE",
      timestamp: Date.now(),
    };
    setLastCommand(cmd);
    sendCommand(cmd, espEndpoint);
  }

  async function sendCommand(cmd: Command, endpoint: string) {
    try {
      const wire: WireCommand = {
        action: cmd.action,
        confidence: cmd.confidence,
        timestamp: cmd.timestamp,
      };
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(wire),
      });
    } catch (e) {
      // Network failure -> ESP32 should timeout-stop; we also stop locally
      setRunning(false);
    }
  }

  function preprocess(video: HTMLVideoElement) {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    c.width = INPUT_SIZE;
    c.height = INPUT_SIZE;
    ctx.drawImage(video, 0, 0, INPUT_SIZE, INPUT_SIZE);
    const imgData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
    const { data } = imgData;
    const floatData = new Float32Array(INPUT_SIZE * INPUT_SIZE * 3);
    for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
      floatData[i * 3 + 0] = data[i * 4 + 0] / 255;
      floatData[i * 3 + 1] = data[i * 4 + 1] / 255;
      floatData[i * 3 + 2] = data[i * 4 + 2] / 255;
    }
    const tensor = new ort.Tensor("float32", floatData, [
      1,
      3,
      INPUT_SIZE,
      INPUT_SIZE,
    ]);
    return { tensor, ctx };
  }

  function nms(boxes: number[][], scores: number[], iouThreshold: number) {
    const idxs = scores
      .map((s, i) => [s, i])
      .sort((a, b) => b[0] - a[0])
      .map(([_, i]) => i as number);
    const selected: number[] = [];
    function iou(a: number[], b: number[]) {
      const ax1 = a[0],
        ay1 = a[1],
        ax2 = a[2],
        ay2 = a[3];
      const bx1 = b[0],
        by1 = b[1],
        bx2 = b[2],
        by2 = b[3];
      const interX1 = Math.max(ax1, bx1);
      const interY1 = Math.max(ay1, by1);
      const interX2 = Math.min(ax2, bx2);
      const interY2 = Math.min(ay2, by2);
      const interW = Math.max(0, interX2 - interX1);
      const interH = Math.max(0, interY2 - interY1);
      const interA = interW * interH;
      const aA = Math.max(0, ax2 - ax1) * Math.max(0, ay2 - ay1);
      const bA = Math.max(0, bx2 - bx1) * Math.max(0, by2 - by1);
      const union = aA + bA - interA;
      return union <= 0 ? 0 : interA / union;
    }
    for (const i of idxs) {
      let keep = true;
      for (const j of selected) {
        if (iou(boxes[i], boxes[j]) > iouThreshold) {
          keep = false;
          break;
        }
      }
      if (keep) selected.push(i);
    }
    return selected;
  }

  function decideFreeSpace(
    detections: { box: number[]; cls: string; score: number }[],
    width: number,
    height: number,
  ): Command {
    const zones = { LEFT: 0, CENTER: 0, RIGHT: 0 } as Record<string, number>;
    let personLeft = false,
      personCenter = false,
      personRight = false;
    for (const d of detections) {
      const [x1, y1, x2, y2] = d.box;
      const cx = (x1 + x2) / 2;
      const zone = zoneFromX(cx, width);
      const isLowerImage = (y1 + y2) / 2 > height * 0.6; // closer to robot
      const isPerson = d.cls === "person";
      const weight = (isPerson ? 1.0 : 0.7) * (isLowerImage ? 1.2 : 1.0);
      zones[zone] += weight;
      if (isPerson) {
        if (zone === "LEFT") personLeft = true;
        if (zone === "CENTER") personCenter = true;
        if (zone === "RIGHT") personRight = true;
      }
    }
    const centerClear = zones.CENTER < 0.5;
    const leftClear = zones.LEFT < 0.5;
    const rightClear = zones.RIGHT < 0.5;

    if (centerClear)
      return {
        action: "FORWARD",
        confidence: 0.9,
        reason: "FREE_PATH",
        timestamp: Date.now(),
      };
    if (leftClear)
      return {
        action: "LEFT",
        confidence: 0.8,
        reason: personLeft ? "PERSON" : "OBSTACLE",
        timestamp: Date.now(),
      };
    if (rightClear)
      return {
        action: "RIGHT",
        confidence: 0.8,
        reason: personRight ? "PERSON" : "OBSTACLE",
        timestamp: Date.now(),
      };
    return {
      action: "STOP",
      confidence: 1.0,
      reason: personCenter ? "PERSON" : "OBSTACLE",
      timestamp: Date.now(),
    };
  }

  // Simple orange cone detection via HSV threshold on the preprocessed canvas
  function detectConeCentroid(): { x: number; y: number; area: number } | null {
    const c = canvasRef.current;
    if (!c) return null;
    const ctx = c.getContext("2d")!;
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const data = img.data;
    let sumX = 0,
      sumY = 0,
      count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255,
        g = data[i + 1] / 255,
        b = data[i + 2] / 255;
      // Convert to HSV (approx); threshold orange hue
      const max = Math.max(r, g, b),
        min = Math.min(r, g, b);
      const d = max - min;
      let h = 0;
      if (d !== 0) {
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
      }
      const s = max === 0 ? 0 : d / max;
      const v = max;
      // Orange band: H in [15, 45], S>0.5, V>0.3 (tune as needed)
      if (h >= 15 && h <= 45 && s > 0.5 && v > 0.3) {
        const pix = i / 4;
        const x = pix % c.width;
        const y = Math.floor(pix / c.width);
        sumX += x;
        sumY += y;
        count++;
      }
    }
    if (count < 100) return null; // small blobs ignored
    return { x: sumX / count, y: sumY / count, area: count };
  }

  type NavState =
    | "IDLE"
    | "SEARCH_TARGET"
    | "ALIGN_TARGET"
    | "MOVE_FORWARD"
    | "AVOID_OBSTACLE"
    | "ARRIVED"
    | "EMERGENCY_STOP";
  const [navState, setNavState] = useState<NavState>("IDLE");

  async function tick() {
    const video = videoRef.current;
    if (!video || !session) return;
    try {
      const { tensor, ctx } = preprocess(video);
      const feeds: Record<string, ort.Tensor> = {};
      // Try common input names
      feeds[session.inputNames[0]] = tensor;
      const results = await session.run(feeds);
      const outName = session.outputNames[0];
      const output = results[outName] as ort.Tensor;
      const arr = output.data as Float32Array | number[];

      // Decode YOLOv8 output in common formats
      const dims = output.dims;
      const boxes: number[][] = [];
      const scores: number[] = [];
      const classes: number[] = [];

      const pushBox = (
        cx: number,
        cy: number,
        w: number,
        h: number,
        conf: number,
        clsProb: number[],
        clsStart = 0,
      ) => {
        if (conf < SCORE_THRESHOLD) return;
        let best = -1,
          bestVal = 0;
        for (let i = 0; i < clsProb.length; i++) {
          const v = clsProb[i];
          if (v > bestVal) {
            bestVal = v;
            best = i;
          }
        }
        const score = conf * bestVal;
        if (score < SCORE_THRESHOLD) return;
        const x1 = Math.max(0, cx - w / 2);
        const y1 = Math.max(0, cy - h / 2);
        const x2 = Math.min(INPUT_SIZE, cx + w / 2);
        const y2 = Math.min(INPUT_SIZE, cy + h / 2);
        boxes.push([x1, y1, x2, y2]);
        scores.push(score);
        classes.push(best + clsStart);
      };

      if (dims.length === 3) {
        // Case A: [1, 84, N] -> rows are [x,y,w,h,80 classes]
        const C = dims[1];
        const N = dims[2];
        if (C >= 84) {
          for (let i = 0; i < N; i++) {
            const x = (arr as any)[i];
            const y = (arr as any)[N + i];
            const w = (arr as any)[2 * N + i];
            const h = (arr as any)[3 * N + i];
            // No explicit obj conf in some exports; treat 1.0
            const clsProb = [] as number[];
            for (let c = 4; c < C; c++) clsProb.push((arr as any)[c * N + i]);
            pushBox(x, y, w, h, 1.0, clsProb);
          }
        }
      } else if (dims.length === 3 && dims[2] === 85) {
        // Case B: [1, N, 85] -> xywh + conf + 80 classes per box
        const N = dims[1];
        for (let n = 0; n < N; n++) {
          const base = n * 85;
          const x = (arr as any)[base + 0];
          const y = (arr as any)[base + 1];
          const w = (arr as any)[base + 2];
          const h = (arr as any)[base + 3];
          const conf = (arr as any)[base + 4];
          const clsProb = (arr as any).slice(base + 5, base + 85);
          pushBox(x, y, w, h, conf, clsProb);
        }
      } else {
        // Fallback: try stride 85 over flat data
        const stride = 85;
        for (let i = 0; i + stride <= arr.length; i += stride) {
          const x = (arr as any)[i + 0];
          const y = (arr as any)[i + 1];
          const w = (arr as any)[i + 2];
          const h = (arr as any)[i + 3];
          const conf = (arr as any)[i + 4];
          const clsProb = (arr as any).slice(i + 5, i + 85);
          pushBox(x, y, w, h, conf, clsProb);
        }
      }
      const keep = nms(boxes, scores, NMS_IOU_THRESHOLD);
      const detections = keep.map((idx) => {
        const clsIdx = classes[idx];
        const clsName =
          (classMap && classMap[clsIdx]) || CLASS_MAP[clsIdx] || `c${clsIdx}`;
        return { box: boxes[idx], score: scores[idx], cls: clsName };
      });

      // Draw for debugging
      const c = canvasRef.current!;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.strokeStyle = "#00ff88";
      ctx.lineWidth = 2;
      for (const d of detections) {
        const [x1, y1, x2, y2] = d.box;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      }

      // Cone detection
      const cone = detectConeCentroid();
      if (cone) {
        ctx.fillStyle = "#ffaa00";
        ctx.beginPath();
        ctx.arc(cone.x, cone.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // FSM
      let cmd: Command = {
        action: "STOP",
        confidence: 1.0,
        reason: "OBSTACLE",
        timestamp: Date.now(),
      };
      const now = Date.now();
      switch (navState) {
        case "IDLE": {
          // Wait for operator to start
          cmd = {
            action: "STOP",
            confidence: 1.0,
            reason: "FREE_PATH",
            timestamp: now,
          };
          break;
        }
        case "SEARCH_TARGET": {
          if (cone) {
            setNavState("ALIGN_TARGET");
            cmd = {
              action: "STOP",
              confidence: 0.9,
              reason: "FREE_PATH",
              timestamp: now,
            };
          } else {
            cmd = {
              action: "ROTATE_LEFT",
              confidence: 0.9,
              reason: "FREE_PATH",
              timestamp: now,
            };
          }
          break;
        }
        case "ALIGN_TARGET": {
          if (!cone) {
            setNavState("SEARCH_TARGET");
            cmd = {
              action: "ROTATE_LEFT",
              confidence: 0.9,
              reason: "FREE_PATH",
              timestamp: now,
            };
          } else {
            const offset = cone.x / INPUT_SIZE - 0.5; // negative left, positive right
            if (Math.abs(offset) < 0.05) {
              setNavState("MOVE_FORWARD");
              cmd = {
                action: "STOP",
                confidence: 0.9,
                reason: "FREE_PATH",
                timestamp: now,
              };
            } else if (offset < 0) {
              cmd = {
                action: "ROTATE_LEFT",
                confidence: 0.9,
                reason: "FREE_PATH",
                timestamp: now,
              };
            } else {
              cmd = {
                action: "ROTATE_RIGHT",
                confidence: 0.9,
                reason: "FREE_PATH",
                timestamp: now,
              };
            }
          }
          break;
        }
        case "MOVE_FORWARD": {
          // Obstacle avoidance via free-space check
          const free = decideFreeSpace(detections, INPUT_SIZE, INPUT_SIZE);
          if (free.action === "FORWARD") {
            // Check if cone is near (area threshold)
            if (cone && cone.area > INPUT_SIZE * INPUT_SIZE * 0.15) {
              setNavState("ARRIVED");
              cmd = {
                action: "STOP",
                confidence: 1.0,
                reason: "FREE_PATH",
                timestamp: now,
              };
            } else {
              cmd = {
                action: "FORWARD",
                confidence: 0.9,
                reason: free.reason,
                timestamp: now,
              };
            }
          } else if (free.action === "LEFT" || free.action === "RIGHT") {
            setNavState("AVOID_OBSTACLE");
            cmd = free;
          } else {
            cmd = free; // STOP
          }
          break;
        }
        case "AVOID_OBSTACLE": {
          // Use free-space; when center clear, go back to align/forward depending on cone
          const free = decideFreeSpace(detections, INPUT_SIZE, INPUT_SIZE);
          if (free.action === "FORWARD") {
            setNavState(cone ? "ALIGN_TARGET" : "SEARCH_TARGET");
            cmd = {
              action: "STOP",
              confidence: 0.9,
              reason: "FREE_PATH",
              timestamp: now,
            };
          } else {
            cmd = free;
          }
          break;
        }
        case "ARRIVED": {
          cmd = {
            action: "STOP",
            confidence: 1.0,
            reason: "FREE_PATH",
            timestamp: now,
          };
          break;
        }
        case "EMERGENCY_STOP": {
          cmd = {
            action: "STOP",
            confidence: 1.0,
            reason: "OBSTACLE",
            timestamp: now,
          };
          break;
        }
      }

      setLastCommand(cmd);
      sendCommand(cmd, espEndpoint);
    } catch (e) {
      issueStop("InferenceFailure");
      setRunning(false);
    }
  }

  useEffect(() => {
    if (!running) return;
    const id = setInterval(tick, COMMAND_FREQ_MS);
    return () => clearInterval(id);
  }, [running, session, espEndpoint, navState]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white relative overflow-hidden">
      {/* Enhanced Animated Background */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,_rgba(120,119,198,0.4),transparent_50%)]" />
        <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_70%_80%,_rgba(255,119,198,0.3),transparent_50%)]" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-cyan-500/15 to-purple-500/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-20 right-20 w-64 h-64 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-full blur-2xl animate-pulse delay-1000" />
        <div className="absolute bottom-20 left-20 w-48 h-48 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-full blur-2xl animate-pulse delay-2000" />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-cyan-400/20 rounded-full"
            initial={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
              opacity: 0,
            }}
            animate={{
              y: [null, -100],
              opacity: [0, 1, 0],
              transition: {
                duration: Math.random() * 10 + 10,
                repeat: Infinity,
                delay: Math.random() * 10,
              },
            }}
          />
        ))}
      </div>

      {/* Enhanced Header */}
      <div className="relative z-10 p-6 pb-4">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="inline-block mb-4"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-purple-400 rounded-full blur-xl opacity-30 animate-pulse" />
              <div className="relative bg-gradient-to-r from-cyan-500 to-purple-600 p-4 rounded-full shadow-2xl">
                <div className="text-6xl">🤖</div>
              </div>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-3 leading-tight"
          >
            AI Perception
            <br />
            <span className="text-3xl sm:text-4xl lg:text-5xl font-semibold bg-gradient-to-r from-purple-300 to-cyan-300 bg-clip-text text-transparent">
              Control Center
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-slate-300 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed"
          >
            Advanced real-time object detection & autonomous navigation system
            <br />
            <span className="text-cyan-400 font-semibold">
              Powered by YOLOv8 & ONNX Runtime
            </span>
          </motion.p>

          {/* Status indicators */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8 }}
            className="flex justify-center items-center gap-6 mt-6"
          >
            <div className="flex items-center gap-2 bg-slate-800/50 backdrop-blur-sm px-4 py-2 rounded-full border border-slate-700/50">
              <div
                className={`w-3 h-3 rounded-full ${session ? "bg-green-400 animate-pulse" : "bg-yellow-400 animate-bounce"}`}
              />
              <span className="text-sm font-medium text-slate-300">
                AI Model: {session ? "Active" : "Loading..."}
              </span>
            </div>

            <div className="flex items-center gap-2 bg-slate-800/50 backdrop-blur-sm px-4 py-2 rounded-full border border-slate-700/50">
              <div
                className={`w-3 h-3 rounded-full ${running ? "bg-cyan-400 animate-pulse" : "bg-slate-500"}`}
              />
              <span className="text-sm font-medium text-slate-300">
                System: {running ? "Running" : "Standby"}
              </span>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Enhanced Main Content */}
      <div className="relative z-10 px-6 pb-6">
        <div className="max-w-7xl mx-auto">
          {/* Video & Canvas Grid - Enhanced Layout */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8"
          >
            {/* Enhanced Camera Feed */}
            <Card className="bg-slate-800/60 backdrop-blur-xl border-slate-700/60 overflow-hidden shadow-2xl hover:shadow-cyan-500/10 transition-shadow duration-500 group">
              <div className="p-6 border-b border-slate-700/60 bg-gradient-to-r from-slate-800/80 to-slate-700/80">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-cyan-400 flex items-center gap-3">
                    <motion.div
                      animate={{ rotate: running ? 360 : 0 }}
                      transition={{
                        duration: 2,
                        repeat: running ? Infinity : 0,
                        ease: "linear",
                      }}
                      className="w-4 h-4 bg-cyan-400 rounded-full flex items-center justify-center"
                    >
                      <div className="w-2 h-2 bg-slate-900 rounded-full" />
                    </motion.div>
                    Live Camera Feed
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-xs text-green-400 font-medium">
                      LIVE
                    </span>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-64 lg:h-80 xl:h-96 object-cover rounded-xl border border-slate-600 shadow-inner"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/20 to-transparent rounded-xl pointer-events-none" />
                </div>
              </div>
            </Card>

            {/* Enhanced Detection Overlay */}
            <Card className="bg-slate-800/60 backdrop-blur-xl border-slate-700/60 overflow-hidden shadow-2xl hover:shadow-purple-500/10 transition-shadow duration-500 group">
              <div className="p-6 border-b border-slate-700/60 bg-gradient-to-r from-slate-800/80 to-slate-700/80">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-purple-400 flex items-center gap-3">
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="w-4 h-4 bg-purple-400 rounded-full flex items-center justify-center"
                    >
                      <div className="w-1.5 h-1.5 bg-slate-900 rounded-full" />
                    </motion.div>
                    AI Detection Overlay
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                    <span className="text-xs text-blue-400 font-medium">
                      AI ACTIVE
                    </span>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    className="w-full h-64 lg:h-80 xl:h-96 bg-slate-900 rounded-xl border border-slate-600 shadow-inner"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/20 to-transparent rounded-xl pointer-events-none" />
                  <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs text-cyan-400 font-medium border border-slate-700/50">
                    YOLOv8 Model
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Enhanced Control Panel */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
          >
            {/* Navigation State - Enhanced */}
            <Card className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 backdrop-blur-xl border-slate-700/60 p-6 hover:shadow-cyan-500/20 hover:shadow-lg transition-all duration-300 group">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                  Navigation State
                </h4>
                <motion.div
                  animate={{ rotate: running ? 360 : 0 }}
                  transition={{
                    duration: 3,
                    repeat: running ? Infinity : 0,
                    ease: "linear",
                  }}
                  className="w-6 h-6 bg-cyan-500/20 rounded-full flex items-center justify-center"
                >
                  <div className="w-3 h-3 bg-cyan-400 rounded-full" />
                </motion.div>
              </div>
              <div className="text-3xl font-bold text-cyan-400 mb-2">
                {navState.replace("_", " ")}
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: running ? "100%" : "0%" }}
                  transition={{ duration: 2, ease: "easeInOut" }}
                />
              </div>
            </Card>

            {/* Last Command - Enhanced */}
            <Card className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 backdrop-blur-xl border-slate-700/60 p-6 hover:shadow-purple-500/20 hover:shadow-lg transition-all duration-300 group">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                  Last Command
                </h4>
                <div className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center">
                  <div className="w-3 h-3 bg-purple-400 rounded-full animate-pulse" />
                </div>
              </div>
              <div className="text-3xl font-bold text-purple-400 mb-2">
                {lastCommand?.action || "NONE"}
              </div>
              <div className="text-sm text-slate-500">
                {lastCommand
                  ? `${Math.round(lastCommand.confidence * 100)}% confidence`
                  : "Waiting for input"}
              </div>
            </Card>

            {/* Model Status - Enhanced */}
            <Card className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 backdrop-blur-xl border-slate-700/60 p-6 hover:shadow-green-500/20 hover:shadow-lg transition-all duration-300 group">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                  AI Model
                </h4>
                <motion.div
                  animate={{ scale: session ? [1, 1.1, 1] : [1, 0.9, 1] }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center"
                >
                  <div
                    className={`w-3 h-3 rounded-full ${session ? "bg-green-400" : "bg-yellow-400 animate-bounce"}`}
                  />
                </motion.div>
              </div>
              <div className="text-2xl font-bold text-green-400 mb-2">
                {session ? "Active" : "Loading..."}
              </div>
              <div className="text-xs text-slate-500">YOLOv8 ONNX Model</div>
            </Card>

            {/* ESP Endpoint - Enhanced */}
            <Card className="bg-gradient-to-br from-slate-800/60 to-slate-700/60 backdrop-blur-xl border-slate-700/60 p-6 hover:shadow-pink-500/20 hover:shadow-lg transition-all duration-300 group">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                  ESP Endpoint
                </h4>
                <div className="w-6 h-6 bg-pink-500/20 rounded-full flex items-center justify-center">
                  <div className="w-3 h-3 bg-pink-400 rounded-full" />
                </div>
              </div>
              <input
                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-400 focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-400/20 transition-all duration-300"
                value={espEndpoint}
                onChange={(e) => setEspEndpoint(e.target.value)}
                placeholder="http://ESP32-IP/cmd"
              />
              <div className="text-xs text-slate-500 mt-2">
                Hardware connection
              </div>
            </Card>
          </motion.div>

          {/* Enhanced Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex flex-wrap justify-center gap-6 mb-8"
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={() => {
                  setRunning((r) => !r);
                  if (!running) setNavState("SEARCH_TARGET");
                }}
                className={`relative overflow-hidden px-8 py-4 text-lg font-bold rounded-2xl shadow-2xl transition-all duration-500 ${
                  running
                    ? "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-red-500/25"
                    : "bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white shadow-cyan-500/25"
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
                <div className="relative z-10 flex items-center gap-3">
                  <motion.div
                    animate={{ rotate: running ? 360 : 0 }}
                    transition={{
                      duration: 1,
                      repeat: running ? Infinity : 0,
                      ease: "linear",
                    }}
                    className="w-5 h-5"
                  >
                    {running ? "⏹️" : "▶️"}
                  </motion.div>
                  {running ? "Stop Perception" : "Start Perception"}
                </div>
              </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={() => setNavState("SEARCH_TARGET")}
                disabled={running}
                variant="outline"
                className="relative overflow-hidden px-8 py-4 text-lg font-bold rounded-2xl border-2 border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white transition-all duration-500 shadow-lg hover:shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
                <div className="relative z-10 flex items-center gap-3">
                  <div className="w-5 h-5">🎯</div>
                  Search Target
                </div>
              </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={() => setNavState("IDLE")}
                disabled={running}
                variant="outline"
                className="relative overflow-hidden px-8 py-4 text-lg font-bold rounded-2xl border-2 border-cyan-500 text-cyan-400 hover:bg-cyan-500 hover:text-white transition-all duration-500 shadow-lg hover:shadow-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
                <div className="relative z-10 flex items-center gap-3">
                  <div className="w-5 h-5">🏠</div>
                  Reset to Idle
                </div>
              </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={() => issueStop("ManualStop")}
                variant="outline"
                className="relative overflow-hidden px-8 py-4 text-lg font-bold rounded-2xl border-2 border-red-500 text-red-400 hover:bg-red-500 hover:text-white transition-all duration-500 shadow-lg hover:shadow-red-500/25"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
                <div className="relative z-10 flex items-center gap-3">
                  <div className="w-5 h-5">🛑</div>
                  Emergency Stop
                </div>
              </Button>
            </motion.div>
          </motion.div>

          {/* Status Messages */}
          {lastCommand && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <Card className="bg-slate-800/50 backdrop-blur-lg border-slate-700/50 p-6 max-w-md mx-auto">
                <div className="text-lg font-semibold text-white mb-2">
                  Command: {lastCommand.action}
                </div>
                <div className="text-sm text-slate-400">
                  Reason: {lastCommand.reason} | Confidence:{" "}
                  {Math.round(lastCommand.confidence * 100)}%
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  {new Date(lastCommand.timestamp).toLocaleTimeString()}
                </div>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

// COCO class names (first 80)
const CLASS_MAP = [
  "person",
  "bicycle",
  "car",
  "motorcycle",
  "airplane",
  "bus",
  "train",
  "truck",
  "boat",
  "traffic light",
  "fire hydrant",
  "stop sign",
  "parking meter",
  "bench",
  "bird",
  "cat",
  "dog",
  "horse",
  "sheep",
  "cow",
  "elephant",
  "bear",
  "zebra",
  "giraffe",
  "backpack",
  "umbrella",
  "handbag",
  "tie",
  "suitcase",
  "frisbee",
  "skis",
  "snowboard",
  "sports ball",
  "kite",
  "baseball bat",
  "baseball glove",
  "skateboard",
  "surfboard",
  "tennis racket",
  "bottle",
  "wine glass",
  "cup",
  "fork",
  "knife",
  "spoon",
  "bowl",
  "banana",
  "apple",
  "sandwich",
  "orange",
  "broccoli",
  "carrot",
  "hot dog",
  "pizza",
  "donut",
  "cake",
  "chair",
  "couch",
  "potted plant",
  "bed",
  "dining table",
  "toilet",
  "tv",
  "laptop",
  "mouse",
  "remote",
  "keyboard",
  "cell phone",
  "microwave",
  "oven",
  "toaster",
  "sink",
  "refrigerator",
  "book",
  "clock",
  "vase",
  "scissors",
  "teddy bear",
  "hair drier",
  "toothbrush",
];
