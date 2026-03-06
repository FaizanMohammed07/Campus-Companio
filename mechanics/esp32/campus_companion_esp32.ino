// ============================================================
//  Guido — Campus Companion Robot — ESP32 Motor Controller
//  Serial USB Version (COM9 @ 115200 baud)
//
//  ARCHITECTURE:
//    Laptop Python Vision Server sends commands over USB Serial.
//    Commands: CRUISE, STOP, LEFT, RIGHT, BACK, SCAN,
//              PREFER_LEFT, PREFER_RIGHT
//    ESP32 reads Serial, applies ultrasonic safety overrides,
//    then executes the motor command.
//
//  SAFETY LAYERS (highest priority first):
//    L1  HARD STOP      — FRONT < 20 cm → immediate full stop
//    L2  DEADLOCK        — LEFT < 15 AND RIGHT < 15 → STOP
//    L3  SIDE COLLISION  — LEFT < 15 → turn right
//                        — RIGHT < 15 → turn left
//    L4  SOFT SLOWDOWN   — FRONT 20–50 cm → reduce PWM to 60%
//    L5  WATCHDOG        — No valid cmd for >1000 ms → STOP
//    L6  EXECUTE         — Serial command
// ============================================================

#include <ESP32Servo.h>

// ======================== TIMING ========================
const unsigned long WATCHDOG_TIMEOUT_MS = 1000;
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
#define US_FRONT_TRIG  4
#define US_FRONT_ECHO  16
#define US_LEFT_TRIG   5
#define US_LEFT_ECHO   17
#define US_RIGHT_TRIG  19
#define US_RIGHT_ECHO  21

// ── Safety thresholds (cm) ──
#define HARD_STOP_CM     20
#define SOFT_SLOW_CM     50
#define SIDE_DANGER_CM   15

// ======================== SERVO ========================
#define SERVO_PIN  18
Servo avoidServo;

// ======================== STATUS LED ========================
#define STATUS_LED  2

// ======================== PWM CONFIG ========================
#define PWM_FREQ  1000
#define PWM_RES   8    // 0-255

// ======================== SPEED PROFILES ========================
#define SPEED_FULL    160
#define SPEED_REDUCED 100
#define TURN_SPEED    200
#define SCAN_SPEED    160   // PWM for 360° scan rotation

// ======================== SCAN CONFIG ========================
#define SCAN_DURATION_MS  3000  // tune for exact 360°
bool scanInProgress = false;

// ======================== STATE ========================
String currentCmd = "STOP";
long   dFront     = -1;
long   dLeft      = -1;
long   dRight     = -1;

// ======================== FORWARD DECLARATIONS ========================
void  readSerialCommand();
void  readSensors();
void  applyCommand(String cmd);
long  readUltrasonic(int trig, int echo);
void  emergencyStop();
void  moveForward(int speed);
void  moveBackward(int speed);
void  turnLeft(int speed);
void  turnRight(int speed);
void  spinInPlace(int speed);
void  executeScan();

// ============================================================
//                          SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\n========================================");
  Serial.println("  Guido Campus Robot — Serial USB Mode");
  Serial.println("  COM9 @ 115200 baud");
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

  // Status LED
  pinMode(STATUS_LED, OUTPUT);
  digitalWrite(STATUS_LED, LOW);

  lastValidCmdMs = millis();
  Serial.println("[BOOT] Ready — send commands via Serial\n");
}

// ============================================================
//                         MAIN LOOP
// ============================================================
void loop() {
  // 1. Read ultrasonic sensors
  readSensors();

  // 2. Read command from Serial (laptop Python → USB → ESP32)
  readSerialCommand();

  // 3. Watchdog: auto-stop if no valid command for >1 s
  if (millis() - lastValidCmdMs > WATCHDOG_TIMEOUT_MS) {
    currentCmd = "STOP";
  }

  // 4. Execute with safety overrides
  applyCommand(currentCmd);

  // 5. Status LED: solid = moving, off = stopped
  digitalWrite(STATUS_LED, currentCmd != "STOP" ? HIGH : LOW);
}

// ============================================================
//                  SERIAL COMMAND READING
//   Laptop sends newline-terminated commands:
//     CRUISE, STOP, LEFT, RIGHT, BACK, SCAN,
//     PREFER_LEFT, PREFER_RIGHT
// ============================================================
void readSerialCommand() {
  if (!Serial.available()) return;

  String cmd = Serial.readStringUntil('\n');
  cmd.trim();

  if (cmd.length() == 0) return;

  // Validate known commands
  if (cmd == "CRUISE"       || cmd == "STOP"         ||
      cmd == "PREFER_LEFT"  || cmd == "PREFER_RIGHT" ||
      cmd == "LEFT"         || cmd == "RIGHT"        ||
      cmd == "BACK"         || cmd == "SCAN") {

    currentCmd     = cmd;
    lastValidCmdMs = millis();
    Serial.print("[CMD] ");
    Serial.println(currentCmd);
  } else {
    Serial.print("[CMD] Unknown: ");
    Serial.println(cmd);
  }
}

// ============================================================
//                    ULTRASONIC READING
// ============================================================
long readUltrasonic(int trig, int echo) {
  digitalWrite(trig, LOW);
  delayMicroseconds(2);
  digitalWrite(trig, HIGH);
  delayMicroseconds(10);
  digitalWrite(trig, LOW);

  long duration = pulseIn(echo, HIGH, 20000);
  if (duration == 0) return -1;

  return duration * 0.034 / 2;
}

void readSensors() {
  dFront = readUltrasonic(US_FRONT_TRIG, US_FRONT_ECHO);
  delay(5);
  dLeft  = readUltrasonic(US_LEFT_TRIG,  US_LEFT_ECHO);
  delay(5);
  dRight = readUltrasonic(US_RIGHT_TRIG, US_RIGHT_ECHO);

  Serial.printf("[US] F:%ld L:%ld R:%ld\n", dFront, dLeft, dRight);
}

// ============================================================
//     COMMAND EXECUTION + SAFETY LAYERS
// ============================================================
void applyCommand(String cmd) {

  // ── LAYER 1: HARD STOP — FRONT < 20 cm ──
  if (dFront != -1 && dFront < HARD_STOP_CM) {
    Serial.printf("[SAFETY L1] HARD STOP — front=%ld cm\n", dFront);
    emergencyStop();
    return;
  }

  // ── LAYER 2: DEADLOCK — both sides blocked ──
  bool leftDanger  = (dLeft  != -1 && dLeft  < SIDE_DANGER_CM);
  bool rightDanger = (dRight != -1 && dRight < SIDE_DANGER_CM);

  if (leftDanger && rightDanger && cmd != "STOP" && cmd != "BACK") {
    Serial.printf("[SAFETY L2] DEADLOCK — L=%ld R=%ld\n", dLeft, dRight);
    emergencyStop();
    return;
  }

  // ── LAYER 3: SIDE COLLISION AVOIDANCE ──
  if (cmd != "STOP" && cmd != "BACK") {
    if (leftDanger) {
      Serial.printf("[SAFETY L3] Left=%ld → turn RIGHT\n", dLeft);
      turnRight(TURN_SPEED);
      return;
    }
    if (rightDanger) {
      Serial.printf("[SAFETY L3] Right=%ld → turn LEFT\n", dRight);
      turnLeft(TURN_SPEED);
      return;
    }
  }

  // ── LAYER 4: SOFT SLOWDOWN — FRONT 20–50 cm ──
  bool frontSlow = (dFront != -1 && dFront < SOFT_SLOW_CM);
  int  fwdSpeed  = frontSlow ? SPEED_REDUCED : SPEED_FULL;

  // ── LAYER 5: WATCHDOG — handled in loop() ──

  // ── LAYER 6: EXECUTE COMMAND ──
  if (cmd == "CRUISE") {
    moveForward(fwdSpeed);
  }
  else if (cmd == "PREFER_LEFT" || cmd == "LEFT") {
    turnLeft(TURN_SPEED);
  }
  else if (cmd == "PREFER_RIGHT" || cmd == "RIGHT") {
    turnRight(TURN_SPEED);
  }
  else if (cmd == "BACK") {
    moveBackward(SPEED_REDUCED);
  }
  else if (cmd == "SCAN") {
    executeScan();
  }
  else {
    // STOP or unknown
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

// Pivot LEFT — left wheels backward, right wheels forward
void turnLeft(int speed) {
  ledcWrite(L_RPWM, 0);
  ledcWrite(L_LPWM, speed);
  ledcWrite(R_RPWM, speed);
  ledcWrite(R_LPWM, 0);
}

// Pivot RIGHT — left wheels forward, right wheels backward
void turnRight(int speed) {
  ledcWrite(L_RPWM, speed);
  ledcWrite(L_LPWM, 0);
  ledcWrite(R_RPWM, 0);
  ledcWrite(R_LPWM, speed);
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
