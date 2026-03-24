/**
 * GamepadController.tsx — PS5 DualSense controller support for GUIDO.
 *
 * Polls navigator.getGamepads() at 50ms, reads axes/buttons,
 * sends manual/assisted commands to backend. Renders no visible UI
 * (mode overlay is managed by the parent via callbacks).
 *
 * Cleans up ALL event listeners and intervals on unmount.
 */

import { useEffect, useRef, useCallback } from "react";

// ── Types ──

export type ControlMode = "manual" | "assisted" | "autonomous";

interface GamepadControllerProps {
  mode: ControlMode;
  onModeChange: (mode: ControlMode) => void;
  onControllerConnected: (connected: boolean) => void;
  onCommandSent: (command: string, speed: number) => void;
}

// ── Constants ──

const DEADZONE = 0.12;
const POLL_INTERVAL_MS = 50;
const HEARTBEAT_MS = 200;

// PS5 button indices
const BTN_CROSS = 0;
const BTN_CIRCLE = 1;
const BTN_SQUARE = 2;
const BTN_TRIANGLE = 3;
const BTN_L1 = 4;
// const BTN_R1 = 5;      // reserved
// const BTN_L2 = 6;      // reserved
const BTN_R2 = 7;
const BTN_DPAD_UP = 12;
const BTN_DPAD_DOWN = 13;
const BTN_DPAD_LEFT = 14;
const BTN_DPAD_RIGHT = 15;
const BTN_L3 = 10;
const BTN_TOUCHPAD = 17;

// ── Helpers ──

function applyDeadzone(value: number, threshold = DEADZONE): number {
  if (Math.abs(value) < threshold) return 0;
  return value;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function isPressed(btn: GamepadButton | undefined): boolean {
  return btn?.pressed ?? false;
}

function analogValue(btn: GamepadButton | undefined): number {
  return btn?.value ?? 0;
}

export default function GamepadController({
  mode,
  onModeChange,
  onControllerConnected,
  onCommandSent,
}: GamepadControllerProps) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCmdRef = useRef<string>("STOP");
  const lastSpeedRef = useRef<number>(0);
  const lastSendTsRef = useRef<number>(0);
  const modeRef = useRef<ControlMode>(mode);
  const prevModeRef = useRef<ControlMode>("autonomous"); // for touchpad toggle
  const sendingRef = useRef<boolean>(false);

  // Keep modeRef in sync with prop
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // ── Send command to backend ──
  const sendCommand = useCallback(
    async (command: string, speed: number) => {
      if (sendingRef.current) return;
      sendingRef.current = true;
      try {
        console.debug("[Gamepad] sending", { command, mode: modeRef.current });
        await fetch("/api/manual/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            command,
            mode: modeRef.current,
          }),
        });
        onCommandSent(command, speed);
      } catch (e) {
        console.error("[Gamepad] Send failed:", e);
      } finally {
        sendingRef.current = false;
      }
    },
    [onCommandSent],
  );

  // ── Poll loop ──
  const pollGamepad = useCallback(() => {
    const gamepads = navigator.getGamepads();
    if (!gamepads) return;

    // Find the first connected gamepad
    let gp: Gamepad | null = null;
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i]) {
        gp = gamepads[i];
        break;
      }
    }
    if (!gp) return;

    const currentMode = modeRef.current;
    const buttons = gp.buttons;
    const axes = gp.axes;

    // ── Button state reads ──
    const crossPressed = isPressed(buttons[BTN_CROSS]);
    const circlePressed = isPressed(buttons[BTN_CIRCLE]);
    const squarePressed = isPressed(buttons[BTN_SQUARE]);
    const trianglePressed = isPressed(buttons[BTN_TRIANGLE]);
    const l1Pressed = isPressed(buttons[BTN_L1]);
    const r2Value = analogValue(buttons[BTN_R2]);
    const dpadUp = isPressed(buttons[BTN_DPAD_UP]);
    const dpadDown = isPressed(buttons[BTN_DPAD_DOWN]);
    const dpadLeft = isPressed(buttons[BTN_DPAD_LEFT]);
    const dpadRight = isPressed(buttons[BTN_DPAD_RIGHT]);
    // Touchpad — fallback to L3 if not available
    const touchpadPressed = buttons[BTN_TOUCHPAD]
      ? isPressed(buttons[BTN_TOUCHPAD])
      : isPressed(buttons[BTN_L3]);

    // ── Left stick with deadzone ──
    const lx = applyDeadzone(axes[0] ?? 0);
    const ly = applyDeadzone(axes[1] ?? 0);

    // ── Speed calculation ──
    const baseSpeed = l1Pressed ? 0.3 : 0.4 + r2Value * 0.6;
    const speed = clamp01(baseSpeed);

    // ── Mode switching (always active regardless of mode) ──
    if (circlePressed) {
      onModeChange("autonomous");
      return;
    }
    if (squarePressed) {
      onModeChange("assisted");
      return;
    }
    if (touchpadPressed) {
      // Toggle manual on/off
      if (currentMode === "manual") {
        onModeChange(prevModeRef.current !== "manual" ? prevModeRef.current : "autonomous");
      } else {
        prevModeRef.current = currentMode;
        onModeChange("manual");
      }
      return;
    }

    // ── Only send motor commands in manual or assisted mode ──
    if (currentMode === "autonomous") return;

    // ── Command priority logic ──
    let command = "STOP";

    if (crossPressed) {
      command = "STOP"; // emergency stop
    } else if (trianglePressed) {
      command = currentMode === "manual" ? "STOP" : "SCAN";
    } else if (dpadUp) {
      command = "CRUISE";
    } else if (dpadDown) {
      command = "BACK";
    } else if (dpadLeft) {
      command = "LEFT";
    } else if (dpadRight) {
      command = "RIGHT";
    } else if (ly < -DEADZONE) {
      command = "CRUISE"; // stick forward
    } else if (ly > DEADZONE) {
      command = "BACK"; // stick backward
    } else if (lx < -DEADZONE) {
      command = "LEFT"; // stick left
    } else if (lx > DEADZONE) {
      command = "RIGHT"; // stick right
    }

    // ── Send only when changed or heartbeat ──
    const now = Date.now();
    const changed = command !== lastCmdRef.current;
    const heartbeatDue = now - lastSendTsRef.current > HEARTBEAT_MS;

    // Don't spam identical STOP commands
    if (command === "STOP" && lastCmdRef.current === "STOP" && !heartbeatDue) {
      return;
    }

    if (changed || heartbeatDue) {
      lastCmdRef.current = command;
      lastSpeedRef.current = speed;
      lastSendTsRef.current = now;
      void sendCommand(command, speed);
    }
  }, [onModeChange, sendCommand]);

  // ── Connect / disconnect listeners + poll interval ──
  useEffect(() => {
    const handleConnected = (e: GamepadEvent) => {
      console.log("[Gamepad] Connected:", e.gamepad.id);
      onControllerConnected(true);
    };
    const handleDisconnected = (e: GamepadEvent) => {
      console.log("[Gamepad] Disconnected:", e.gamepad.id);
      onControllerConnected(false);
    };

    window.addEventListener("gamepadconnected", handleConnected);
    window.addEventListener("gamepaddisconnected", handleDisconnected);

    // Check if already connected
    const gamepads = navigator.getGamepads();
    if (gamepads) {
      for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) {
          onControllerConnected(true);
          break;
        }
      }
    }

    // Start polling
    intervalRef.current = setInterval(pollGamepad, POLL_INTERVAL_MS);

    return () => {
      window.removeEventListener("gamepadconnected", handleConnected);
      window.removeEventListener("gamepaddisconnected", handleDisconnected);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [pollGamepad, onControllerConnected]);

  // Renders nothing — invisible background component
  return null;
}
