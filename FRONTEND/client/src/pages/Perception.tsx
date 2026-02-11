import { useEffect, useRef, useState } from "react";
import * as ort from "onnxruntime-web";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

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
    <div className="p-4 space-y-3">
      <h2 className="text-xl font-bold">Phone Perception</h2>
      <div className="grid gap-2 grid-cols-2">
        <Card className="p-2">
          <video ref={videoRef} autoPlay playsInline muted className="w-full" />
        </Card>
        <Card className="p-2">
          <canvas ref={canvasRef} className="w-full" />
        </Card>
      </div>
      <div className="flex gap-2 items-center">
        <Button
          onClick={() => {
            setRunning((r) => !r);
            if (!running) setNavState("SEARCH_TARGET");
          }}
        >
          {running ? "Stop" : "Start"}
        </Button>
        <input
          className="border px-2 py-1 rounded w-80"
          value={espEndpoint}
          onChange={(e) => setEspEndpoint(e.target.value)}
          placeholder="http://ESP32-IP/cmd"
        />
      </div>
      <pre className="text-xs bg-muted p-2 rounded overflow-auto">
        {lastCommand ? JSON.stringify(lastCommand, null, 2) : "No command yet"}
      </pre>
      <p className="text-sm text-muted-foreground">
        Safety: if camera/model/network fails, STOP is sent and loop halts.
      </p>
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
