// ============================================================
//  Guido — Campus Companion Robot — ESP32 Motor Controller
//  Production Firmware v2.0
//
//  ARCHITECTURE:
//    ESP32 polls Python Vision Server POST /robot-command
//    every 150 ms.  Python is the SINGLE AUTHORITY for
//    movement commands.  ESP32 only adds safety overrides.
//
//  SAFETY LAYERS (highest priority first):
//    L1  HARD STOP      — FRONT < 20 cm → immediate full stop
//    L2  DEADLOCK        — LEFT < 15 AND RIGHT < 15 → STOP
//    L3  SIDE COLLISION  — LEFT < 15 → turn right
//                        — RIGHT < 15 → turn left
//    L4  SOFT SLOWDOWN   — FRONT 20–50 cm → reduce PWM to 60%
//    L5  WATCHDOG        — No valid cmd for >1000 ms → STOP
//    L6  EXECUTE         — Vision server command
//
//  Ultrasonic reads use pulseIn() with 20 ms timeout
//  (non-blocking enough at 150 ms poll rate).
// ============================================================

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>

// ======================== WIFI ========================
const char* WIFI_SSID     = "TANMAY2.0";
const char* WIFI_PASS     = "12346789";
const char* SERVER_URL    = "http://10.175.187.25:8000/robot-command";

const unsigned long WIFI_RECONNECT_INTERVAL_MS = 5000;
unsigned long       lastWifiAttemptMs          = 0;

// ======================== TIMING ========================
const unsigned long POLL_INTERVAL_MS    = 150;
const unsigned long HTTP_TIMEOUT_MS     = 300;
const unsigned long WATCHDOG_TIMEOUT_MS = 1000;
const unsigned long US_STAGGER_MS       = 8;

unsigned long lastPollMs     = 0;
unsigned long lastValidCmdMs = 0;

// ======================== LEFT BTS7960 ========================
#define L_RPWM  25
#define L_LPWM  26
#define L_EN    27

// ======================== RIGHT BTS7960 ========================
#define R_RPWM  32
#define R_LPWM  33
#define R_EN    14

// ======================== ULTRASONIC SENSORS ========================
// FRONT
#define US_FRONT_TRIG  4
#define US_FRONT_ECHO  16
// LEFT
#define US_LEFT_TRIG   5
#define US_LEFT_ECHO   17
// RIGHT
#define US_RIGHT_TRIG  19
#define US_RIGHT_ECHO  21

// ── Safety thresholds (cm) ──
#define HARD_STOP_CM         20   // Layer 1: FRONT < 20 → full stop
#define SOFT_SLOW_CM         50   // Layer 4: FRONT 20-50 → 60% PWM
#define SIDE_DANGER_CM       15   // Layer 2/3: side collision zone
#define SERVO_TRIGGER_CM      8   // very close → trigger servo arm

// ======================== SERVO ========================
#define SERVO_PIN  18
Servo avoidServo;
bool  servoBusy          = false;
const int SERVO_REST_DEG = 90;
const int SERVO_ACT_DEG  = 180;

// ======================== STATUS LED ========================
#define STATUS_LED  2

// ======================== PWM CONFIG ========================
#define PWM_FREQ  1000
#define PWM_RES   8    // 0-255

// ======================== SPEED PROFILES ========================
#define SPEED_FULL    180
#define SPEED_REDUCED 108   // 60% of full (Layer 4 slowdown)
#define TURN_FAST     220
#define TURN_SLOW      40
#define TURN_SHARP    255

// ======================== STATE ========================
String currentCmd      = "STOP";
String previousCmd     = "STOP";
long   dFront          = -1;
long   dLeft           = -1;
long   dRight          = -1;
bool   watchdogTripped = false;
String safetyOverride  = "";   // tracks which safety layer is active

// ======================== FORWARD DECLARATIONS ========================
void  pollServer();
void  applyCommand(const String& cmd);
long  readUltrasonic(int trigPin, int echoPin);
void  readAllSensors();
bool  ensureWiFi();
void  triggerServo();
void  emergencyStop();
void  moveForward(int speed);
void  moveBackward(int speed);
void  turnLeft(int innerSpeed, int outerSpeed);
void  turnRight(int innerSpeed, int outerSpeed);
void  blinkLED(int count, int onMs);

// ============================================================
//                          SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\n========================================");
  Serial.println("  Guido Campus Robot — ESP32 v2.0");
  Serial.println("  STARTS IN STOP MODE (no movement)");
  Serial.println("========================================");

  // Motor driver enable
  pinMode(L_EN, OUTPUT);
  pinMode(R_EN, OUTPUT);
  digitalWrite(L_EN, HIGH);
  digitalWrite(R_EN, HIGH);

  // LEDC PWM (ESP32 Arduino Core 3.x)
  ledcAttach(L_RPWM, PWM_FREQ, PWM_RES);
  ledcAttach(L_LPWM, PWM_FREQ, PWM_RES);
  ledcAttach(R_RPWM, PWM_FREQ, PWM_RES);
  ledcAttach(R_LPWM, PWM_FREQ, PWM_RES);

  // Start STOPPED — robot does NOT move at boot
  emergencyStop();

  // Ultrasonic pins
  pinMode(US_FRONT_TRIG, OUTPUT);
  pinMode(US_FRONT_ECHO, INPUT);
  pinMode(US_LEFT_TRIG,  OUTPUT);
  pinMode(US_LEFT_ECHO,  INPUT);
  pinMode(US_RIGHT_TRIG, OUTPUT);
  pinMode(US_RIGHT_ECHO, INPUT);

  // Servo
  avoidServo.attach(SERVO_PIN);
  avoidServo.write(SERVO_REST_DEG);

  // Status LED
  pinMode(STATUS_LED, OUTPUT);
  digitalWrite(STATUS_LED, LOW);

  // WiFi
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  Serial.printf("[WiFi] Connecting to %s\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  unsigned long wifiStart = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - wifiStart < 10000) {
    delay(400);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi] Connected — IP: %s\n", WiFi.localIP().toString().c_str());
    blinkLED(3, 150);
  } else {
    Serial.println("\n[WiFi] FAILED — will retry in loop");
    blinkLED(6, 80);
  }

  lastValidCmdMs = millis();
  Serial.println("[BOOT] Ready — waiting for mission from Python server\n");
}

// ============================================================
//                         MAIN LOOP
// ============================================================
void loop() {
  unsigned long now = millis();

  // Rate-limit
  if (now - lastPollMs < POLL_INTERVAL_MS) return;
  lastPollMs = now;

  // 1. WiFi (non-blocking reconnect)
  bool online = ensureWiFi();

  // 2. Read ultrasonic sensors
  readAllSensors();

  // 3. Poll vision server
  if (online) {
    pollServer();
  }

  // 4. Watchdog: auto-stop if no valid command for >1 s
  if (now - lastValidCmdMs > WATCHDOG_TIMEOUT_MS) {
    if (!watchdogTripped) {
      Serial.println("[WATCHDOG] No valid command — forcing STOP");
      watchdogTripped = true;
    }
    currentCmd = "STOP";
  }

  // 5. Execute with safety overrides
  applyCommand(currentCmd);

  // 6. Status LED: solid = moving, off = stopped
  digitalWrite(STATUS_LED, currentCmd != "STOP" ? HIGH : LOW);
}

// ============================================================
//                     WIFI RECONNECT
// ============================================================
bool ensureWiFi() {
  if (WiFi.status() == WL_CONNECTED) return true;

  unsigned long now = millis();
  if (now - lastWifiAttemptMs < WIFI_RECONNECT_INTERVAL_MS) return false;
  lastWifiAttemptMs = now;

  Serial.println("[WiFi] Reconnecting...");
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  return false;
}

// ============================================================
//                    ULTRASONIC READING
// ============================================================
long readUltrasonic(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  // 20 ms timeout ≈ 340 cm max range
  long duration = pulseIn(echoPin, HIGH, 20000);
  if (duration == 0) return -1;  // no echo

  long cm = (duration * 343L) / 20000;
  return cm;
}

void readAllSensors() {
  dFront = readUltrasonic(US_FRONT_TRIG, US_FRONT_ECHO);
  delay(US_STAGGER_MS);
  dLeft  = readUltrasonic(US_LEFT_TRIG,  US_LEFT_ECHO);
  delay(US_STAGGER_MS);
  dRight = readUltrasonic(US_RIGHT_TRIG, US_RIGHT_ECHO);

  Serial.printf("[US] F=%3ld  L=%3ld  R=%3ld cm\n", dFront, dLeft, dRight);
}

// ============================================================
//                     SERVER POLLING
// ============================================================
void pollServer() {
  HTTPClient http;
  http.begin(SERVER_URL);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");

  int code = http.POST("{}");

  if (code == 200) {
    String body = http.getString();
    StaticJsonDocument<256> doc;
    DeserializationError err = deserializeJson(doc, body);

    if (!err && doc.containsKey("command")) {
      String newCmd = doc["command"].as<String>();

      if (newCmd == "CRUISE"       || newCmd == "STOP"         ||
          newCmd == "PREFER_LEFT"  || newCmd == "PREFER_RIGHT" ||
          newCmd == "LEFT"         || newCmd == "RIGHT"        ||
          newCmd == "BACK") {

        previousCmd    = currentCmd;
        currentCmd     = newCmd;
        lastValidCmdMs = millis();
        watchdogTripped = false;

        if (currentCmd != previousCmd) {
          Serial.printf("[CMD] %s → %s\n", previousCmd.c_str(), currentCmd.c_str());
        }
      } else {
        Serial.printf("[CMD] Unknown: %s\n", newCmd.c_str());
      }
    } else {
      Serial.printf("[CMD] Parse error: %s\n", err.c_str());
    }
  } else if (code > 0) {
    Serial.printf("[HTTP] Error: %d\n", code);
  } else {
    Serial.printf("[HTTP] Failed: %s\n", http.errorToString(code).c_str());
  }

  http.end();
}

// ============================================================
//        COMMAND EXECUTION + 5-LAYER SAFETY SYSTEM
// ============================================================
void applyCommand(const String& cmd) {
  safetyOverride = "";

  // ────────────────────────────────────────────
  //  LAYER 1: HARD STOP — FRONT < 20 cm
  //  Highest priority. Immediate full stop.
  // ────────────────────────────────────────────
  if (dFront != -1 && dFront < HARD_STOP_CM) {
    safetyOverride = "L1_HARD_STOP";
    emergencyStop();

    if (dFront < SERVO_TRIGGER_CM) {
      triggerServo();
    }

    Serial.printf("[SAFETY L1] HARD STOP — front=%ld cm\n", dFront);
    return;
  }

  // ────────────────────────────────────────────
  //  LAYER 2: DEADLOCK — LEFT < 15 AND RIGHT < 15
  //  Both sides blocked → cannot turn → STOP.
  // ────────────────────────────────────────────
  bool leftDanger  = (dLeft  != -1 && dLeft  < SIDE_DANGER_CM);
  bool rightDanger = (dRight != -1 && dRight < SIDE_DANGER_CM);

  if (leftDanger && rightDanger && cmd != "STOP" && cmd != "BACK") {
    safetyOverride = "L2_DEADLOCK";
    emergencyStop();
    Serial.printf("[SAFETY L2] DEADLOCK — L=%ld R=%ld cm\n", dLeft, dRight);
    return;
  }

  // ────────────────────────────────────────────
  //  LAYER 3: SIDE COLLISION AVOIDANCE
  //  LEFT < 15 → force turn right
  //  RIGHT < 15 → force turn left
  // ────────────────────────────────────────────
  if (cmd != "STOP" && cmd != "BACK") {
    if (leftDanger) {
      safetyOverride = "L3_LEFT_AVOID";
      Serial.printf("[SAFETY L3] Left obstacle=%ld → turn RIGHT\n", dLeft);
      turnRight(TURN_SLOW, TURN_FAST);
      return;
    }
    if (rightDanger) {
      safetyOverride = "L3_RIGHT_AVOID";
      Serial.printf("[SAFETY L3] Right obstacle=%ld → turn LEFT\n", dRight);
      turnLeft(TURN_SLOW, TURN_FAST);
      return;
    }
  }

  // ────────────────────────────────────────────
  //  LAYER 4: SOFT SLOWDOWN — FRONT 20–50 cm
  //  Reduce forward PWM to 60%.
  // ────────────────────────────────────────────
  bool frontSlow = (dFront != -1 && dFront < SOFT_SLOW_CM);
  int  fwdSpeed  = frontSlow ? SPEED_REDUCED : SPEED_FULL;

  if (frontSlow) {
    safetyOverride = "L4_SLOWDOWN";
  }

  // ────────────────────────────────────────────
  //  LAYER 5: WATCHDOG — handled in loop()
  //  (currentCmd forced to STOP above)
  // ────────────────────────────────────────────

  // ────────────────────────────────────────────
  //  LAYER 6: EXECUTE VISION SERVER COMMAND
  // ────────────────────────────────────────────
  if (cmd == "CRUISE") {
    moveForward(fwdSpeed);
  }
  else if (cmd == "PREFER_LEFT") {
    // Camera mirror: vision "left" → robot physical left obstacle → steer RIGHT
    turnRight(TURN_SLOW, frontSlow ? SPEED_REDUCED : TURN_FAST);
  }
  else if (cmd == "PREFER_RIGHT") {
    // Camera mirror: vision "right" → robot physical right obstacle → steer LEFT
    turnLeft(TURN_SLOW, frontSlow ? SPEED_REDUCED : TURN_FAST);
  }
  else if (cmd == "LEFT") {
    turnLeft(0, TURN_SHARP);
  }
  else if (cmd == "RIGHT") {
    turnRight(0, TURN_SHARP);
  }
  else if (cmd == "BACK") {
    moveBackward(SPEED_REDUCED);
  }
  else {
    // STOP or unknown → safe stop
    emergencyStop();
  }
}

// ============================================================
//                    MOTOR PRIMITIVES
// ============================================================

void emergencyStop() {
  ledcWrite(L_RPWM, 0);
  ledcWrite(L_LPWM, 0);
  ledcWrite(R_RPWM, 0);
  ledcWrite(R_LPWM, 0);
}

void moveForward(int speed) {
  ledcWrite(L_RPWM, speed);
  ledcWrite(L_LPWM, 0);
  ledcWrite(R_RPWM, speed);
  ledcWrite(R_LPWM, 0);
}

void moveBackward(int speed) {
  ledcWrite(L_RPWM, 0);
  ledcWrite(L_LPWM, speed);
  ledcWrite(R_RPWM, 0);
  ledcWrite(R_LPWM, speed);
}

void turnLeft(int innerSpeed, int outerSpeed) {
  ledcWrite(L_RPWM, innerSpeed);
  ledcWrite(L_LPWM, 0);
  ledcWrite(R_RPWM, outerSpeed);
  ledcWrite(R_LPWM, 0);
}

void turnRight(int innerSpeed, int outerSpeed) {
  ledcWrite(L_RPWM, outerSpeed);
  ledcWrite(L_LPWM, 0);
  ledcWrite(R_RPWM, innerSpeed);
  ledcWrite(R_LPWM, 0);
}

// ============================================================
//                        SERVO
// ============================================================
void triggerServo() {
  if (servoBusy) return;
  servoBusy = true;
  Serial.println("[SERVO] Triggered — obstacle very close!");
  avoidServo.write(SERVO_ACT_DEG);
  delay(400);
  avoidServo.write(SERVO_REST_DEG);
  delay(300);
  servoBusy = false;
}

// ============================================================
//                      STATUS LED
// ============================================================
void blinkLED(int count, int onMs) {
  for (int i = 0; i < count; i++) {
    digitalWrite(STATUS_LED, HIGH);
    delay(onMs);
    digitalWrite(STATUS_LED, LOW);
    delay(onMs);
  }
}
