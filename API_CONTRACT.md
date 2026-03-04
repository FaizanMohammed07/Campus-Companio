# API Contract — Campus Companion Robot v2.0

## 1. Backend API (Node.js → Frontend)

Base URL: `http://localhost:5002`

---

### POST /api/mission
Start a navigation mission.

**Request:**
```json
{
  "destination": "LIBRARY"
}
```

**Destination enum:** `A_BLOCK | B_BLOCK | C_BLOCK | ADMISSION | FEE | ADMIN | LIBRARY | EXAM | CANTEEN`

**Response (200):**
```json
{
  "ok": true,
  "mode": "GUIDE",
  "destination": "LIBRARY"
}
```

**Response (400):**
```json
{
  "error": "Invalid destination"
}
```

**Response (502):**
```json
{
  "error": "Vision server unreachable"
}
```

---

### POST /api/stop
Stop the robot and cancel current mission.

**Request:** empty body

**Response (200):**
```json
{
  "ok": true,
  "mode": "IDLE"
}
```

---

### GET /api/status
Get live robot and mission status. Frontend polls this at 500ms.

**Response (200):**
```json
{
  "mode": "GUIDE",
  "destination": "LIBRARY",
  "pipeline_healthy": true,
  "nav_state": "FORWARD",
  "intent": "FORWARD",
  "person_detected": false,
  "person_zone": "NONE",
  "confidence": 0.85,
  "nav_obstacles": {},
  "nav_paths": { "c_blocks": 2 }
}
```

**`nav_state` values:**
| Value | Meaning |
|-------|---------|
| `IDLE` | No mission, robot stopped |
| `SEARCH_PATH` | Rotating to find path markers |
| `ALIGN_PATH` | Aligning to detected path |
| `FORWARD` | Moving toward destination |
| `AVOID_OBSTACLE` | Avoiding person/obstacle |
| `ARRIVED` | Reached destination |
| `EMERGENCY_STOP` | Stopped by emergency |

---

### GET /api/health
System health check.

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "visionServer": "ok"
}
```

---

### POST /api/voice
Voice command processing (via OpenRouter LLM).

**Request:**
```json
{
  "text": "take me to the library",
  "context": { "currentPage": "/visitor" }
}
```

**Response (200):**
```json
{
  "intent": "GUIDE",
  "target": "LIBRARY",
  "ui_action": "START_GUIDANCE",
  "response_text": "I'll guide you to the Library. Please follow me."
}
```

---

## 2. Vision Server API (Python Flask → Backend & ESP32)

Base URL: `http://127.0.0.1:8000`

---

### POST /set-destination
Set navigation target. Called by backend.

**Request:**
```json
{
  "destination": "LIBRARY"
}
```

**Response (200):**
```json
{
  "ok": true,
  "destination": "LIBRARY"
}
```

**Response (400):**
```json
{
  "error": "Unknown destination: INVALID. Valid: A_BLOCK, B_BLOCK, ..."
}
```

---

### POST /stop
Stop current mission and enter IDLE.

**Request:** empty body

**Response (200):**
```json
{
  "ok": true
}
```

---

### GET /status
Full pipeline telemetry.

**Response (200):**
```json
{
  "pipeline_healthy": true,
  "nav_state": "FORWARD",
  "intent": "FORWARD",
  "person_detected": false,
  "person_zone": "NONE",
  "confidence": 0.85,
  "nav_obstacles": {},
  "nav_paths": { "c_blocks": 2 }
}
```

---

### POST /robot-command
Polled by ESP32 every 150ms. Returns next motor command.

**Request:** empty body (ESP32 sends POST with empty body)

**Response (200):**
```json
{
  "command": "FORWARD",
  "source": "vision",
  "ts": 1705312200.123
}
```

**Command values:** `STOP | FORWARD | PREFER_LEFT | PREFER_RIGHT`

---

### GET /health
Simple health check.

**Response (200):**
```json
{
  "status": "ok"
}
```

---

## 3. ESP32 API (HTTP Client → Vision Server)

The ESP32 is a **client only** — it does not expose any HTTP endpoints.

It polls `POST /robot-command` on the Vision Server every 150ms and executes the returned command after passing it through the 5-layer safety system.

### Safety Override Priority (highest first)

| Layer | Condition | Action | Overrides |
|-------|-----------|--------|-----------|
| L1 | FRONT < 20cm | HARD STOP | Everything |
| L2 | LEFT < 15 AND RIGHT < 15 | DEADLOCK STOP | L3-L6 |
| L3 | LEFT < 15 | Turn right; RIGHT < 15 → Turn left | L4-L6 |
| L4 | FRONT 20-50cm | Reduce speed to 60% | L5-L6 |
| L5 | No valid cmd for >1000ms | WATCHDOG STOP | L6 |
| L6 | — | Execute vision command | — |

### Camera Mirror Mapping
Due to camera mounting (mirror image):
- `PREFER_LEFT` from vision → `turnRight()` on motors
- `PREFER_RIGHT` from vision → `turnLeft()` on motors

This is **intentional** and correct.

---

## 4. Error Handling & Reconnection

| Component | Failure | Recovery |
|-----------|---------|----------|
| Frontend → Backend | fetch fails | UI shows "Connecting…" |
| Backend → Vision | 3s timeout | Returns 502 to frontend |
| Vision → Camera | Camera.grab() fails | pipeline_healthy=false, STOP sent |
| Vision → YOLO | Model inference fails | Falls back to STOP |
| ESP32 → Vision | HTTP poll fails | Watchdog triggers STOP after 1s |
| ESP32 sensors | Reading fails | Treated as 0cm (most conservative) |

---

## 5. Port Summary

| Service | Port | Protocol |
|---------|------|----------|
| Frontend (Vite dev) | 5173 | HTTP |
| Backend (Express) | 5002 | HTTP |
| Vision Server (Flask) | 8000 | HTTP |
| ESP32 | WiFi client | HTTP (outbound only) |
