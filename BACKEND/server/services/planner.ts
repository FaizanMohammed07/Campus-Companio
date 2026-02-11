import { z } from "zod";

export type BlockId = "A_BLOCK" | "B_BLOCK" | "C_BLOCK";

// Perception payload from Vision server
export const PerceptionSchema = z.object({
  target_visible: z.boolean(),
  target_offset: z.number().min(-1).max(1), // -1 left, +1 right
  confidence: z.number().min(0).max(1),
  obstacle: z.boolean(),
});
export type Perception = z.infer<typeof PerceptionSchema>;

export type Action =
  | "FORWARD"
  | "LEFT"
  | "RIGHT"
  | "ROTATE_LEFT"
  | "ROTATE_RIGHT"
  | "STOP";

export interface MotionIntent {
  action: Action;
  speed: number; // 0..1
  confidence: number; // 0..1
  reason?: string;
  duration_ms?: number; // optional bounded duration
}

export type PlannerState =
  | "IDLE"
  | "SEARCH_TARGET"
  | "ALIGN_TARGET"
  | "MOVE_FORWARD"
  | "AVOID_OBSTACLE"
  | "ARRIVED"
  | "EMERGENCY_STOP";

// Simple topological graph
export const Graph: Record<BlockId, BlockId[]> = {
  A_BLOCK: ["B_BLOCK"],
  B_BLOCK: ["A_BLOCK", "C_BLOCK"],
  C_BLOCK: ["B_BLOCK"],
};

export function bfsPath(start: BlockId, goal: BlockId): BlockId[] {
  if (start === goal) return [start];
  const q: BlockId[] = [start];
  const visited = new Set<BlockId>([start]);
  const parent = new Map<BlockId, BlockId>();
  while (q.length) {
    const u = q.shift()!;
    for (const v of Graph[u] || []) {
      if (!visited.has(v)) {
        visited.add(v);
        parent.set(v, u);
        if (v === goal) {
          // reconstruct
          const path: BlockId[] = [v];
          let cur = v;
          while (parent.has(cur)) {
            const p = parent.get(cur)!;
            path.push(p);
            cur = p as BlockId;
          }
          return path.reverse();
        }
        q.push(v);
      }
    }
  }
  return [];
}

export interface PlannerConfig {
  alignTolerance: number; // ε
  arrivalConfidence: number; // δ proxy via landmark conf
  forwardSpeed: number;
  turnSpeed: number;
  commandRateMs: number; // min interval between commands
  perceptionTimeoutMs: number; // loss-of-vision timeout
  avoidanceRotateMs: number; // rotate duration during avoidance
}

export class Planner {
  private state: PlannerState = "IDLE";
  private nextWaypoints: BlockId[] = [];
  private lastPerception: Perception | null = null;
  private lastPerceptionAt = 0;
  private lastCommandAt = 0;
  private cfg: PlannerConfig;

  constructor(cfg?: Partial<PlannerConfig>) {
    this.cfg = {
      alignTolerance: 0.1,
      arrivalConfidence: 0.9,
      forwardSpeed: 0.6,
      turnSpeed: 0.5,
      commandRateMs: 120,
      perceptionTimeoutMs: 2000,
      avoidanceRotateMs: 350,
      ...cfg,
    };
  }

  mission(start: BlockId, goal: BlockId): BlockId[] {
    const path = bfsPath(start, goal);
    this.nextWaypoints = path.slice(1); // exclude current
    this.state = this.nextWaypoints.length ? "SEARCH_TARGET" : "ARRIVED";
    return path;
  }

  currentState() {
    return {
      state: this.state,
      nextWaypoints: this.nextWaypoints.slice(),
      lastPerception: this.lastPerception,
    };
  }

  updatePerception(p: Perception) {
    this.lastPerception = p;
    this.lastPerceptionAt = Date.now();
  }

  private canSend(): boolean {
    return Date.now() - this.lastCommandAt >= this.cfg.commandRateMs;
  }

  step(): MotionIntent | null {
    const now = Date.now();
    const p = this.lastPerception;
    const stale = now - this.lastPerceptionAt > this.cfg.perceptionTimeoutMs;

    // Safety: if stale perception, stop and scan
    if (!p || stale) {
      this.state = "SEARCH_TARGET";
      if (this.canSend()) {
        this.lastCommandAt = now;
        return { action: "ROTATE_LEFT", speed: this.cfg.turnSpeed, confidence: 0.7, reason: "searching target", duration_ms: 300 };
      }
      return null;
    }

    // Emergency transitions
    if (this.state !== "EMERGENCY_STOP" && p.obstacle) {
      this.state = "AVOID_OBSTACLE";
    }

    switch (this.state) {
      case "IDLE": {
        return this.canSend()
          ? (this.lastCommandAt = now, { action: "STOP", speed: 0, confidence: 1, reason: "idle" })
          : null;
      }
      case "SEARCH_TARGET": {
        if (p.target_visible && p.confidence >= 0.6) {
          this.state = "ALIGN_TARGET";
        }
        if (!this.canSend()) return null;
        this.lastCommandAt = now;
        return { action: "ROTATE_LEFT", speed: this.cfg.turnSpeed, confidence: 0.7, reason: "searching target", duration_ms: 300 };
      }
      case "ALIGN_TARGET": {
        if (p.obstacle) {
          this.state = "AVOID_OBSTACLE";
          break;
        }
        // Check alignment tolerance
        if (Math.abs(p.target_offset) <= this.cfg.alignTolerance) {
          this.state = "MOVE_FORWARD";
        }
        if (!this.canSend()) return null;
        this.lastCommandAt = now;
        if (p.target_offset < -this.cfg.alignTolerance) {
          return { action: "LEFT", speed: Math.min(1, this.cfg.turnSpeed + Math.abs(p.target_offset) * 0.5), confidence: p.confidence, reason: "align_left" };
        } else if (p.target_offset > this.cfg.alignTolerance) {
          return { action: "RIGHT", speed: Math.min(1, this.cfg.turnSpeed + Math.abs(p.target_offset) * 0.5), confidence: p.confidence, reason: "align_right" };
        } else {
          return { action: "FORWARD", speed: this.cfg.forwardSpeed, confidence: p.confidence, reason: "aligned_forward" };
        }
      }
      case "MOVE_FORWARD": {
        if (p.obstacle) {
          this.state = "AVOID_OBSTACLE";
          break;
        }
        // Arrival proxy: high confidence and small offset sustained
        if (p.target_visible && p.confidence >= this.cfg.arrivalConfidence && Math.abs(p.target_offset) <= this.cfg.alignTolerance) {
          // Pop next waypoint
          if (this.nextWaypoints.length) {
            this.nextWaypoints.shift();
          }
          this.state = this.nextWaypoints.length ? "SEARCH_TARGET" : "ARRIVED";
        }
        if (!this.canSend()) return null;
        this.lastCommandAt = now;
        return { action: "FORWARD", speed: this.cfg.forwardSpeed, confidence: p.confidence, reason: "advance" };
      }
      case "AVOID_OBSTACLE": {
        if (!this.canSend()) return null;
        this.lastCommandAt = now;
        // Choose turn direction opposite of offset sign (simple potential-style)
        const turnLeft = p.target_offset > 0; // if target right, turn left to clear
        const action: Action = turnLeft ? "ROTATE_LEFT" : "ROTATE_RIGHT";
        return { action, speed: this.cfg.turnSpeed, confidence: 0.8, reason: "avoid_obstacle", duration_ms: this.cfg.avoidanceRotateMs };
      }
      case "ARRIVED": {
        if (!this.canSend()) return null;
        this.lastCommandAt = now;
        return { action: "STOP", speed: 0, confidence: 1, reason: "arrived" };
      }
      case "EMERGENCY_STOP": {
        if (!this.canSend()) return null;
        this.lastCommandAt = now;
        return { action: "STOP", speed: 0, confidence: 1, reason: "emergency" };
      }
      default:
        return null;
    }

    // If we broke to AVIOD_OBSTACLE and sent nothing yet, try sending avoid command
    if (this.state === "AVOID_OBSTACLE" && this.canSend()) {
      this.lastCommandAt = now;
      const turnLeft = p.target_offset > 0;
      const action: Action = turnLeft ? "ROTATE_LEFT" : "ROTATE_RIGHT";
      return { action, speed: this.cfg.turnSpeed, confidence: 0.8, reason: "avoid_obstacle", duration_ms: this.cfg.avoidanceRotateMs };
    }
    return null;
  }
}
