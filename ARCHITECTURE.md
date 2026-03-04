# Campus Companion Robot — Production Architecture v2.0

## Single-Authority Navigation Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React/Vite)                        │
│                         Port 5173 (dev)                             │
│                                                                     │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────────┐ │
│  │ VisitorHelp  │  │ GuidancePage  │  │    EmergencyStop         │ │
│  │              │  │               │  │                          │ │
│  │ POST /api/   │  │ GET /api/     │  │  POST /api/stop          │ │
│  │   mission    │  │   status      │  │  (safety-critical)       │ │
│  │ {destination}│  │ polls @500ms  │  └──────────────────────────┘ │
│  └──────┬───────┘  └──────┬────────┘                               │
│         │                 │         ┌──────────────────────────┐   │
│         │                 │         │   Perception (Monitor)   │   │
│         │                 │         │   GET /api/status @250ms │   │
│         │                 │         │   READ-ONLY, no commands │   │
│         │                 │         └──────────────────────────┘   │
│         │                 │                                        │
│  ┌──────┴─────────────────┴──────────────────────────────────────┐ │
│  │                VoiceController Context                        │ │
│  │  POST /api/mission (guide intent)                             │ │
│  │  POST /api/stop    (stop intent)                              │ │
│  └───────────────────────────┬───────────────────────────────────┘ │
└──────────────────────────────┼─────────────────────────────────────┘
                               │
                    HTTP (fetch)│
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     BACKEND (Node.js/Express)                       │
│                          Port 5002                                  │
│                                                                     │
│  ┌─────────────────────┐  ┌──────────────┐  ┌───────────────────┐ │
│  │   mission.ts        │  │  voice.ts    │  │   routes.ts       │ │
│  │                     │  │              │  │                   │ │
│  │ POST /api/mission   │  │ POST /api/   │  │ GET /api/health   │ │
│  │ POST /api/stop      │  │   voice      │  │ (checks vision)   │ │
│  │ GET  /api/status    │  │ LLM → intent │  │                   │ │
│  │                     │  │ → mission    │  │                   │ │
│  └──────────┬──────────┘  └──────┬───────┘  └───────────────────┘ │
│             │                    │                                  │
│  ┌──────────┴────────────────────┴──────────────────────────────┐  │
│  │              visionServer.ts (HTTP client)                   │  │
│  │  setVisionDestination(dest) → POST /set-destination          │  │
│  │  stopVisionServer()         → POST /stop                     │  │
│  │  getVisionStatus()          → GET  /status                   │  │
│  │  getVisionHealth()          → GET  /health                   │  │
│  └──────────────────────────────┬───────────────────────────────┘  │
│                                 │                                   │
│              ⚠️ Backend does NOT generate motor commands ⚠️         │
└─────────────────────────────────┼───────────────────────────────────┘
                                  │
                     HTTP (fetch) │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│              PYTHON VISION SERVER (Flask)                            │
│                    Port 8000                                        │
│           ★ SINGLE MOVEMENT AUTHORITY ★                             │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    VisionPipeline                            │  │
│  │                                                              │  │
│  │   Camera ──→ Person YOLO ──→ Nav YOLO ──→ Fusion ──→ Cmd   │  │
│  │  (30fps)    (yolov8n.pt)    (best.pt)     ↓    ↓           │  │
│  │                                         Person   Navigator  │  │
│  │                                         ALWAYS   FSM        │  │
│  │                                         wins                │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   Navigator FSM                              │  │
│  │                                                              │  │
│  │  IDLE ──→ SEARCH_PATH ──→ ALIGN_PATH ──→ FORWARD            │  │
│  │   ↑           ↑                              │               │  │
│  │   │           │         AVOID_OBSTACLE ←─────┘               │  │
│  │   │           │              │                               │  │
│  │   │           └──────────────┘                               │  │
│  │   │                                                          │  │
│  │   ├── ARRIVED (mission complete)                             │  │
│  │   └── EMERGENCY_STOP (from /stop endpoint)                   │  │
│  │                                                              │  │
│  │  When IDLE: returns "STOP" → robot does NOT move             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Endpoints:                                                         │
│    POST /set-destination  ← Backend calls to start mission          │
│    POST /stop             ← Backend calls to abort                  │
│    GET  /status           ← Backend proxies for frontend            │
│    POST /robot-command    ← ESP32 polls this every 150ms            │
│    GET  /health           ← Backend checks connectivity             │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                  HTTP polling  │ (ESP32 → Vision Server)
                  every 150ms   │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ESP32 (Motor Controller)                          │
│                  WiFi connected, polls /robot-command                │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │               5-Layer Safety System                          │  │
│  │                                                              │  │
│  │  L1: HARD STOP      │ FRONT < 20cm → immediate full stop    │  │
│  │  L2: DEADLOCK        │ LEFT<15 AND RIGHT<15 → STOP          │  │
│  │  L3: SIDE COLLISION  │ LEFT<15 → turn right, RIGHT<15 → left│  │
│  │  L4: SOFT SLOWDOWN   │ FRONT 20-50cm → PWM reduced to 60%   │  │
│  │  L5: WATCHDOG        │ No cmd for >1000ms → STOP            │  │
│  │  L6: EXECUTE         │ Vision server command (if safe)       │  │
│  │                                                              │  │
│  │  Boot state: STOP (robot does NOT move at startup)           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ⚠️ ESP32 NEVER decides navigation — only safety overrides ⚠️      │
│  Camera mirror mapping: PREFER_LEFT → turnRight (intentional)       │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow — Complete Mission Lifecycle

```
1. User taps "Guide Me → LIBRARY" on VisitorHelp page
   │
2. Frontend:  POST /api/mission { destination: "LIBRARY" }
   │
3. Backend:   validates destination (Zod enum)
   │           calls setVisionDestination("LIBRARY")
   │           sets local mode = "GUIDE"
   │
4. Vision Server:  navigator.set_destination("LIBRARY")
   │                _DEST_TO_BUCKET maps LIBRARY → "c_blocks"
   │                FSM → SEARCH_PATH
   │
5. Pipeline loop (every frame @ ~15fps):
   │  camera.grab() → person YOLO → nav YOLO → fusion
   │  Person detection ALWAYS overrides nav commands
   │  Navigator FSM decides: FORWARD / PREFER_LEFT / PREFER_RIGHT / STOP
   │
6. ESP32 polls POST /robot-command every 150ms:
   │  Gets: { "command": "FORWARD", "source": "vision", "ts": ... }
   │  Applies 5-layer safety filter
   │  Executes motor command (or overrides with safety stop)
   │
7. Frontend polls GET /api/status every 500ms:
   │  GuidancePage shows: nav_state, person_detected, confidence, intent
   │
8. When nav_state == "ARRIVED":
   │  GuidancePage shows celebration overlay
   │  Robot stops moving
   │
9. User navigates away or taps "Stop Robot":
   │  POST /api/stop → vision server stops → ESP32 gets STOP
```

## Valid Destinations

| ID         | Nav Bucket   | Description         |
|------------|-------------|---------------------|
| A_BLOCK    | a_blocks    | Academic A Block    |
| B_BLOCK    | b_blocks    | Academic B Block    |
| C_BLOCK    | c_blocks    | Academic C Block    |
| ADMISSION  | admission   | Admissions Office   |
| FEE        | fee         | Fee Payment Counter |
| ADMIN      | admin       | Admin Block         |
| LIBRARY    | c_blocks    | Central Library     |
| EXAM       | admin       | Exam Cell           |
| CANTEEN    | b_blocks    | Canteen & Food Court|

## Safety Invariants

1. **Robot does NOT move at boot** — Python navigator starts in IDLE (returns STOP), ESP32 defaults to STOP
2. **No mission = no movement** — IDLE state always returns STOP command
3. **Person detection always wins** — Person avoidance overrides navigation in fusion layer
4. **ESP32 watchdog** — No valid command for >1s → automatic STOP
5. **Hard stop at 20cm** — Ultrasonic L1 override, no software can bypass
6. **Emergency stop** — Frontend button → Backend → Vision → EMERGENCY_STOP state
7. **Graceful shutdown** — Both Python (signal handlers) and Node.js (SIGTERM/SIGINT) shut down cleanly
