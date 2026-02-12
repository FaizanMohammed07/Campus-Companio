import { Router } from "express";
import { storage } from "../storage";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { requireAuth } from "./auth";

const router = Router();

// Validation schemas
const createNavigationSessionSchema = z.object({
  startLocationId: z.string().min(1, "Start location ID is required"),
  endLocationId: z.string().min(1, "End location ID is required"),
  userId: z.string().optional(), // Will be set from authenticated user
  estimatedDuration: z.number().int().positive().optional(),
  path: z
    .array(
      z.object({
        latitude: z.number(),
        longitude: z.number(),
        floor: z.number().int(),
        instruction: z.string().optional(),
      }),
    )
    .optional(),
});

const updateNavigationSessionSchema = z.object({
  status: z.enum(["active", "completed", "cancelled", "paused"]).optional(),
  currentLocationId: z.string().optional(),
  actualDuration: z.number().int().positive().optional(),
  path: z
    .array(
      z.object({
        latitude: z.number(),
        longitude: z.number(),
        floor: z.number().int(),
        instruction: z.string().optional(),
      }),
    )
    .optional(),
});

// GET /api/navigation/active - Get active navigation sessions
router.get("/active", requireAuth, async (req, res) => {
  try {
    const sessions = await storage.getActiveNavigationSessions();
    res.json({ sessions });
  } catch (error) {
    console.error("Get active navigation sessions error:", error);
    res.status(500).json({ error: "Failed to fetch active sessions" });
  }
});

// GET /api/navigation/:id - Get navigation session by ID
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const session = await storage.getNavigationSession(id);

    if (!session) {
      return res.status(404).json({ error: "Navigation session not found" });
    }

    // Check if user owns this session or is admin/faculty
    if (
      session.userId !== req.user.id &&
      !["admin", "faculty"].includes(req.user.role)
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({ session });
  } catch (error) {
    console.error("Get navigation session error:", error);
    res.status(500).json({ error: "Failed to fetch navigation session" });
  }
});

// POST /api/navigation - Create new navigation session
router.post("/", requireAuth, async (req, res) => {
  try {
    const sessionData = createNavigationSessionSchema.parse(req.body);

    // Set user ID from authenticated user
    sessionData.userId = req.user.id;

    // Validate that start and end locations exist
    const startLocation = await storage.getLocation(
      sessionData.startLocationId,
    );
    const endLocation = await storage.getLocation(sessionData.endLocationId);

    if (!startLocation || !endLocation) {
      return res.status(400).json({ error: "Invalid start or end location" });
    }

    const session = await storage.createNavigationSession({
      ...sessionData,
      status: "active",
      startedAt: new Date(),
    });

    // Log navigation session creation
    await storage.createSystemLog(
      "info",
      `Navigation session started from ${startLocation.name} to ${endLocation.name}`,
      "navigation",
      {
        sessionId: session.id,
        userId: req.user.id,
        startLocationId: sessionData.startLocationId,
        endLocationId: sessionData.endLocationId,
      },
    );

    res.status(201).json({ session });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ error: validationError.message });
    }

    console.error("Create navigation session error:", error);
    res.status(500).json({ error: "Failed to create navigation session" });
  }
});

// PUT /api/navigation/:id - Update navigation session
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = updateNavigationSessionSchema.parse(req.body);

    // Get current session
    const currentSession = await storage.getNavigationSession(id);
    if (!currentSession) {
      return res.status(404).json({ error: "Navigation session not found" });
    }

    // Check if user owns this session or is admin/faculty
    if (
      currentSession.userId !== req.user.id &&
      !["admin", "faculty"].includes(req.user.role)
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Set completion time if status is completed
    if (updateData.status === "completed") {
      updateData.actualDuration = Math.floor(
        (Date.now() - currentSession.startedAt.getTime()) / 1000,
      );
    }

    const session = await storage.updateNavigationSession(id, updateData);

    if (!session) {
      return res.status(404).json({ error: "Navigation session not found" });
    }

    // Log navigation session update
    await storage.createSystemLog(
      "info",
      `Navigation session ${id} updated to status: ${updateData.status}`,
      "navigation",
      {
        sessionId: session.id,
        userId: req.user.id,
        oldStatus: currentSession.status,
        newStatus: updateData.status,
      },
    );

    res.json({ session });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ error: validationError.message });
    }

    console.error("Update navigation session error:", error);
    res.status(500).json({ error: "Failed to update navigation session" });
  }
});

// POST /api/navigation/:id/cancel - Cancel navigation session
router.post("/:id/cancel", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Get current session
    const currentSession = await storage.getNavigationSession(id);
    if (!currentSession) {
      return res.status(404).json({ error: "Navigation session not found" });
    }

    // Check if user owns this session or is admin/faculty
    if (
      currentSession.userId !== req.user.id &&
      !["admin", "faculty"].includes(req.user.role)
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (currentSession.status !== "active") {
      return res.status(400).json({ error: "Can only cancel active sessions" });
    }

    const session = await storage.updateNavigationSession(id, {
      status: "cancelled",
    });

    // Log navigation session cancellation
    await storage.createSystemLog(
      "info",
      `Navigation session ${id} cancelled`,
      "navigation",
      { sessionId: session!.id, userId: req.user.id },
    );

    res.json({ message: "Navigation session cancelled successfully" });
  } catch (error) {
    console.error("Cancel navigation session error:", error);
    res.status(500).json({ error: "Failed to cancel navigation session" });
  }
});

export default router;
