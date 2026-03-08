// ============================================================
//  Guido — Campus Companion Robot — ESP32 Motor Controller
//  WiFi HTTP Version — polls Python YOLO Vision Server
//
//  ARCHITECTURE:
//    ESP32 connects to WiFi, polls the Python Vision Server
//    at POST /robot-command every ~150ms to get movement commands.
//    Server response: {"command":"CRUISE"|"STOP"|"LEFT"|"RIGHT"|
//                                "BACK"|"SCAN"|"PREFER_LEFT"|
//                                "PREFER_RIGHT"}
//    ESP32 parses the command and executes the motor action.
//
//  SAFETY LAYERS:
//    L5  WATCHDOG   — No successful HTTP response for >2000 ms → STOP
//    L6  EXECUTE    — Server command
// ============================================================

#include <WiFi.h>
#include <HTTPClient.h>
#include <ESP32Servo.h>

// ======================== WIFI CONFIG ========================
// *** CHANGE THESE TO YOUR NETWORK ***
const char* ssid     = "Sanchit-2.4G";
const char* password = "Lukaluka12";

// ======================== VISION SERVER ========================
// Python YOLO server IP:PORT — change IP to your laptop's
// The server runs on port 8000 by default
String serverUrl = "http://192.168.29.191:8000/robot-command";

// ======================== TIMING ========================
const unsigned long WATCHDOG_TIMEOUT_MS = 2000;  // 2s for WiFi latency
const unsigned long POLL_INTERVAL_MS    = 150;   // poll every 150ms
unsigned long lastValidCmdMs   = 0;
unsigned long lastPollMs       = 0;

// ======================== LEFT BTS7960 ========================
#define L_RPWM  25
#define L_LPWM  26
#define L_EN    27

// ======================== RIGHT BTS7960 ========================
#define R_RPWM  32
#define R_LPWM  33
#define R_EN    14

// ======================== SERVO ========================
#define SERVO_PIN  18
Servo avoidServo;

// ======================== STATUS LED ========================
#define STATUS_LED  2

// ======================== PWM CONFIG ========================
#define PWM_FREQ  1000
#define PWM_RES   8    // 0-255

// ======================== SPEED PROFILES ========================
#define SPEED_FULL     200
#define SPEED_REDUCED  130
#define TURN_SPEED     200
#define SCAN_SPEED     180   // PWM for 360° scan rotation
#define PREFER_FAST    160
#define PREFER_SLOW     80

// ======================== SCAN CONFIG ========================
#define SCAN_DURATION_MS  3000  // tune for exact 360°
bool scanInProgress = false;

// ======================== STATE ========================
String currentCmd = "STOP";

// ======================== FORWARD DECLARATIONS ========================
void  pollServer();
void  parseCommand(String response);
void  applyCommand(String cmd);
void  emergencyStop();
void  moveForward(int speed);
void  moveBackward(int speed);
void  turnLeft(int speed);
void  turnRight(int speed);
void  preferLeft();
void  preferRight();
void  spinInPlace(int speed);
void  executeScan();
void  connectWiFi();

// ============================================================
//                          SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\n========================================");
  Serial.println("  Guido Campus Robot — WiFi HTTP Mode");
  Serial.println("  Polls YOLO Vision Server for commands");
  Serial.println("  STARTS IN STOP MODE (no movement)");
  Serial.println("========================================");

  // Motor driver enable
  pinMode(L_EN, OUTPUT);
  pinMode(R_EN, OUTPUT);
  digitalWrite(L_EN, HIGH);
  digitalWrite(R_EN, HIGH);
  Serial.println("[BOOT] L_EN and R_EN set HIGH");

  // LEDC PWM (ESP32 Arduino Core 3.x)
  ledcAttach(L_RPWM, PWM_FREQ, PWM_RES);
  ledcAttach(L_LPWM, PWM_FREQ, PWM_RES);
  ledcAttach(R_RPWM, PWM_FREQ, PWM_RES);
  ledcAttach(R_LPWM, PWM_FREQ, PWM_RES);
  Serial.println("[BOOT] LEDC PWM attached on all 4 motor pins");

  emergencyStop();

  // Servo
  avoidServo.attach(SERVO_PIN);

  // Status LED
  pinMode(STATUS_LED, OUTPUT);
  digitalWrite(STATUS_LED, LOW);

  // Connect to WiFi
  connectWiFi();

  lastValidCmdMs = millis();
  lastPollMs     = millis();
  Serial.println("[BOOT] Ready — polling server for commands\n");
}

// ============================================================
//                      WIFI CONNECT
// ============================================================
void connectWiFi() {
  Serial.printf("[WIFI] Connecting to %s", ssid);
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    attempts++;
    if (attempts > 40) {  // 20 second timeout
      Serial.println("\n[WIFI] FAILED — restarting ESP32...");
      ESP.restart();
    }
  }

  Serial.println();
  Serial.print("[WIFI] Connected! IP: ");
  Serial.println(WiFi.localIP());
  Serial.printf("[WIFI] Server: %s\n", serverUrl.c_str());
}

// ============================================================
//                         MAIN LOOP
// ============================================================
void loop() {
  // 0. Reconnect WiFi if dropped
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WIFI] Disconnected — reconnecting...");
    emergencyStop();
    connectWiFi();
  }

  // 1. Poll server at fixed interval (~150ms)
  if (millis() - lastPollMs >= POLL_INTERVAL_MS) {
    lastPollMs = millis();
    pollServer();
  }

  // 2. Watchdog: auto-stop if no valid response for >2 s
  if (millis() - lastValidCmdMs > WATCHDOG_TIMEOUT_MS) {
    if (currentCmd != "STOP") {
      Serial.println("[WATCHDOG] Timeout — forcing STOP");
      currentCmd = "STOP";
    }
  }

  // 3. Execute command
  applyCommand(currentCmd);

  // 4. Status LED: solid = moving, off = stopped
  digitalWrite(STATUS_LED, currentCmd != "STOP" ? HIGH : LOW);
}

// ============================================================
//        POLL VISION SERVER — POST /robot-command
//  Response: {"command":"CRUISE"} (or STOP, LEFT, RIGHT, etc.)
// ============================================================
void pollServer() {
  HTTPClient http;
  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(500);  // 500ms HTTP timeout — fast fail

  int httpCode = http.POST("{}");  // POST with empty JSON body

  if (httpCode > 0) {
    String response = http.getString();
    parseCommand(response);
  } else {
    Serial.printf("[HTTP] Error: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
}

// ============================================================
//    PARSE JSON RESPONSE — extract "command" field
//    Lightweight parse: finds "command":"VALUE" in string
// ============================================================
void parseCommand(String response) {
  // Find "command":"VALUE" in JSON
  int cmdIdx = response.indexOf("\"command\"");
  if (cmdIdx == -1) {
    Serial.println("[PARSE] No 'command' field found");
    return;
  }

  // Find the value after the colon
  int colonIdx = response.indexOf(':', cmdIdx);
  if (colonIdx == -1) return;

  // Find opening and closing quotes of the value
  int valStart = response.indexOf('"', colonIdx + 1);
  int valEnd   = response.indexOf('"', valStart + 1);
  if (valStart == -1 || valEnd == -1) return;

  String cmd = response.substring(valStart + 1, valEnd);
  cmd.trim();

  // Validate known commands
  if (cmd == "CRUISE"       || cmd == "STOP"         ||
      cmd == "PREFER_LEFT"  || cmd == "PREFER_RIGHT" ||
      cmd == "LEFT"         || cmd == "RIGHT"        ||
      cmd == "BACK"         || cmd == "SCAN") {

    if (cmd != currentCmd) {
      Serial.printf("[CMD] %s → %s\n", currentCmd.c_str(), cmd.c_str());
    }
    currentCmd     = cmd;
    lastValidCmdMs = millis();
  } else {
    Serial.printf("[CMD] Unknown command: %s\n", cmd.c_str());
  }
}

// ============================================================
//     COMMAND EXECUTION
// ============================================================
void applyCommand(String cmd) {
  // No ultrasonic safety layers — vision server handles avoidance
  // L5 WATCHDOG handled in loop()

  // L6 EXECUTE COMMAND
  if      (cmd == "CRUISE")       moveForward(SPEED_FULL);
  else if (cmd == "LEFT")         turnLeft(TURN_SPEED);
  else if (cmd == "RIGHT")        turnRight(TURN_SPEED);
  else if (cmd == "PREFER_LEFT")  preferLeft();
  else if (cmd == "PREFER_RIGHT") preferRight();
  else if (cmd == "BACK")         moveBackward(SPEED_REDUCED);
  else if (cmd == "SCAN")         executeScan();
  else                            emergencyStop();
}

// ============================================================
//                    MOTOR PRIMITIVES
// ============================================================

void emergencyStop() {
  ledcWrite(L_RPWM, 0);
  ledcWrite(L_LPWM, 0);
  ledcWrite(R_RPWM, 0);
  ledcWrite(R_LPWM, 0);
  Serial.println("[MOTOR] emergencyStop");
}

void moveForward(int speed) {
  ledcWrite(L_RPWM, speed);
  ledcWrite(L_LPWM, 0);
  ledcWrite(R_RPWM, speed);
  ledcWrite(R_LPWM, 0);
  Serial.printf("[MOTOR] moveForward speed=%d\n", speed);
}

void moveBackward(int speed) {
  ledcWrite(L_RPWM, 0);
  ledcWrite(L_LPWM, speed);
  ledcWrite(R_RPWM, 0);
  ledcWrite(R_LPWM, speed);
  Serial.printf("[MOTOR] moveBackward speed=%d\n", speed);
}

// Pivot LEFT — left wheels backward, right wheels forward
void turnLeft(int speed) {
  ledcWrite(L_RPWM, 0);
  ledcWrite(L_LPWM, speed);
  ledcWrite(R_RPWM, speed);
  ledcWrite(R_LPWM, 0);
  Serial.printf("[MOTOR] turnLeft speed=%d\n", speed);
}

// Pivot RIGHT — left wheels forward, right wheels backward
void turnRight(int speed) {
  ledcWrite(L_RPWM, speed);
  ledcWrite(L_LPWM, 0);
  ledcWrite(R_RPWM, 0);
  ledcWrite(R_LPWM, speed);
  Serial.printf("[MOTOR] turnRight speed=%d\n", speed);
}

// Gentle curve LEFT — both wheels forward, right faster
void preferLeft() {
  ledcWrite(L_RPWM, PREFER_SLOW);
  ledcWrite(L_LPWM, 0);
  ledcWrite(R_RPWM, PREFER_FAST);
  ledcWrite(R_LPWM, 0);
  Serial.printf("[MOTOR] preferLeft L=%d R=%d\n", PREFER_SLOW, PREFER_FAST);
}

// Gentle curve RIGHT — both wheels forward, left faster
void preferRight() {
  ledcWrite(L_RPWM, PREFER_FAST);
  ledcWrite(L_LPWM, 0);
  ledcWrite(R_RPWM, PREFER_SLOW);
  ledcWrite(R_LPWM, 0);
  Serial.printf("[MOTOR] preferRight L=%d R=%d\n", PREFER_FAST, PREFER_SLOW);
}

// ============================================================
//                 SPIN-IN-PLACE (for SCAN)
// ============================================================

void spinInPlace(int speed) {
  // Same as turnLeft — clockwise pivot
  ledcWrite(L_RPWM, 0);
  ledcWrite(L_LPWM, speed);
  ledcWrite(R_RPWM, speed);
  ledcWrite(R_LPWM, 0);
}

void executeScan() {
  if (scanInProgress) return;
  scanInProgress = true;

  Serial.println("[SCAN] ---- 360 deg SCAN started ----");
  digitalWrite(STATUS_LED, HIGH);

  spinInPlace(SCAN_SPEED);
  delay(SCAN_DURATION_MS);

  emergencyStop();
  digitalWrite(STATUS_LED, LOW);

  currentCmd     = "STOP";
  lastValidCmdMs = millis();

  Serial.println("[SCAN] ---- 360 deg SCAN complete ----");
  scanInProgress = false;
}
