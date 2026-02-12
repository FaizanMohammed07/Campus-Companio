import { Router } from "express";
import { storage } from "../storage";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { requireAuth, requireRole } from "./auth";

const router = Router();

// Validation schemas
const createRobotCommandSchema = z.object({
  command: z.string().min(1, "Command is required"),
  parameters: z.record(z.any()).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  userId: z.string().optional(), // Will be set from authenticated user
  navigationSessionId: z.string().optional(),
});

const updateRobotCommandSchema = z.object({
  status: z
    .enum(["pending", "executing", "completed", "failed", "cancelled"])
    .optional(),
  result: z.record(z.any()).optional(),
  error: z.string().optional(),
});

// GET /api/robot/commands - Get robot commands
router.get("/commands", requireAuth, async (req, res) => {
  try {
    const status = req.query.status as string;
    const commands = await storage.getRobotCommands(status);

    // Filter commands based on user role
    let filteredCommands = commands;
    if (req.user.role === "student") {
      // Students can only see their own commands
      filteredCommands = commands.filter((cmd) => cmd.userId === req.user.id);
    }
    // Admin and faculty can see all commands

    res.json({ commands: filteredCommands });
  } catch (error) {
    console.error("Get robot commands error:", error);
    res.status(500).json({ error: "Failed to fetch robot commands" });
  }
});

// POST /api/robot/commands - Create robot command
router.post("/commands", requireAuth, async (req, res) => {
  try {
    const commandData = createRobotCommandSchema.parse(req.body);

    // Set user ID from authenticated user
    commandData.userId = req.user.id;

    const robotCommand = await storage.createRobotCommand({
      ...commandData,
      status: "pending",
    });

    // Log robot command creation
    await storage.createSystemLog(
      "info",
      `Robot command created: ${commandData.command}`,
      "robot",
      {
        commandId: robotCommand.id,
        userId: req.user.id,
        command: commandData.command,
        priority: commandData.priority,
      },
    );

    res.status(201).json({ command: robotCommand });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ error: validationError.message });
    }

    console.error("Create robot command error:", error);
    res.status(500).json({ error: "Failed to create robot command" });
  }
});

// PUT /api/robot/commands/:id - Update robot command
router.put("/commands/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = updateRobotCommandSchema.parse(req.body);

    // Get current command
    const currentCommand = await storage
      .getRobotCommands()
      .then((cmds) => cmds.find((cmd) => cmd.id === id));

    if (!currentCommand) {
      return res.status(404).json({ error: "Robot command not found" });
    }

    // Check permissions
    if (
      currentCommand.userId !== req.user.id &&
      !["admin", "faculty"].includes(req.user.role)
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    const command = await storage.updateRobotCommand(id, updateData);

    if (!command) {
      return res.status(404).json({ error: "Robot command not found" });
    }

    // Log robot command update
    await storage.createSystemLog(
      "info",
      `Robot command ${id} updated to status: ${updateData.status}`,
      "robot",
      {
        commandId: command.id,
        userId: req.user.id,
        oldStatus: currentCommand.status,
        newStatus: updateData.status,
      },
    );

    res.json({ command });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ error: validationError.message });
    }

    console.error("Update robot command error:", error);
    res.status(500).json({ error: "Failed to update robot command" });
  }
});

// POST /api/robot/commands/:id/cancel - Cancel robot command
router.post("/commands/:id/cancel", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Get current command
    const currentCommand = await storage
      .getRobotCommands()
      .then((cmds) => cmds.find((cmd) => cmd.id === id));

    if (!currentCommand) {
      return res.status(404).json({ error: "Robot command not found" });
    }

    // Check permissions
    if (
      currentCommand.userId !== req.user.id &&
      !["admin", "faculty"].includes(req.user.role)
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (!["pending", "executing"].includes(currentCommand.status)) {
      return res
        .status(400)
        .json({ error: "Can only cancel pending or executing commands" });
    }

    const command = await storage.updateRobotCommand(id, {
      status: "cancelled",
    });

    // Log command cancellation
    await storage.createSystemLog(
      "info",
      `Robot command ${id} cancelled`,
      "robot",
      { commandId: command!.id, userId: req.user.id },
    );

    res.json({ message: "Robot command cancelled successfully" });
  } catch (error) {
    console.error("Cancel robot command error:", error);
    res.status(500).json({ error: "Failed to cancel robot command" });
  }
});

// GET /api/robot/status - Get robot status and active commands
router.get("/status", requireAuth, async (req, res) => {
  try {
    // Get active commands
    const activeCommands = await storage.getRobotCommands("executing");
    const pendingCommands = await storage.getRobotCommands("pending");

    // Filter based on user permissions
    let filteredActive = activeCommands;
    let filteredPending = pendingCommands;

    if (req.user.role === "student") {
      filteredActive = activeCommands.filter(
        (cmd) => cmd.userId === req.user.id,
      );
      filteredPending = pendingCommands.filter(
        (cmd) => cmd.userId === req.user.id,
      );
    }

    // Get recent system logs for robot status
    const recentLogs = await storage.getSystemLogs(10);

    res.json({
      status: {
        activeCommands: filteredActive.length,
        pendingCommands: filteredPending.length,
        totalCommands: filteredActive.length + filteredPending.length,
      },
      activeCommands: filteredActive.slice(0, 5), // Return last 5 active commands
      pendingCommands: filteredPending.slice(0, 5), // Return last 5 pending commands
      recentLogs: recentLogs
        .filter((log) => log.service === "robot")
        .slice(0, 5),
    });
  } catch (error) {
    console.error("Get robot status error:", error);
    res.status(500).json({ error: "Failed to fetch robot status" });
  }
});

// POST /api/robot/emergency-stop - Emergency stop all robot operations (admin/faculty only)
router.post(
  "/emergency-stop",
  requireAuth,
  requireRole(["admin", "faculty"]),
  async (req, res) => {
    try {
      // Get all executing commands
      const executingCommands = await storage.getRobotCommands("executing");

      // Cancel all executing commands
      const cancelPromises = executingCommands.map((cmd) =>
        storage.updateRobotCommand(cmd.id, { status: "cancelled" }),
      );

      await Promise.all(cancelPromises);

      // Log emergency stop
      await storage.createSystemLog(
        "critical",
        "Emergency stop activated - all executing commands cancelled",
        "robot",
        {
          cancelledCommands: executingCommands.length,
          activatedBy: req.user.id,
        },
      );

      res.json({
        message: "Emergency stop activated",
        cancelledCommands: executingCommands.length,
      });
    } catch (error) {
      console.error("Emergency stop error:", error);
      res.status(500).json({ error: "Failed to execute emergency stop" });
    }
  },
);

export default router;
