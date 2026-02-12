import { Router } from "express";
import { storage } from "../storage";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { requireAuth, requireRole } from "./auth";

const router = Router();

// Validation schemas
const createLocationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  category: z.enum([
    "entrance",
    "facility",
    "classroom",
    "office",
    "parking",
    "other",
  ]),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  floor: z.number().int().default(0),
  building: z.string().optional(),
  isActive: z.boolean().default(true),
});

const updateLocationSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z
    .enum(["entrance", "facility", "classroom", "office", "parking", "other"])
    .optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  floor: z.number().int().optional(),
  building: z.string().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/locations - Get all locations
router.get("/", async (req, res) => {
  try {
    const locations = await storage.getLocations();
    res.json({ locations });
  } catch (error) {
    console.error("Get locations error:", error);
    res.status(500).json({ error: "Failed to fetch locations" });
  }
});

// GET /api/locations/:id - Get location by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const location = await storage.getLocation(id);

    if (!location) {
      return res.status(404).json({ error: "Location not found" });
    }

    res.json({ location });
  } catch (error) {
    console.error("Get location error:", error);
    res.status(500).json({ error: "Failed to fetch location" });
  }
});

// GET /api/locations/category/:category - Get locations by category
router.get("/category/:category", async (req, res) => {
  try {
    const { category } = req.params;

    // Validate category
    const validCategories = [
      "entrance",
      "facility",
      "classroom",
      "office",
      "parking",
      "other",
    ];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: "Invalid category" });
    }

    const locations = await storage.getLocationsByCategory(category);
    res.json({ locations });
  } catch (error) {
    console.error("Get locations by category error:", error);
    res.status(500).json({ error: "Failed to fetch locations" });
  }
});

// POST /api/locations - Create new location (admin/faculty only)
router.post(
  "/",
  requireAuth,
  requireRole(["admin", "faculty"]),
  async (req, res) => {
    try {
      const locationData = createLocationSchema.parse(req.body);

      const location = await storage.createLocation(locationData);

      // Log location creation
      await storage.createSystemLog(
        "info",
        `Location created: ${location.name}`,
        "locations",
        { locationId: location.id, createdBy: req.user.id },
      );

      res.status(201).json({ location });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ error: validationError.message });
      }

      console.error("Create location error:", error);
      res.status(500).json({ error: "Failed to create location" });
    }
  },
);

// PUT /api/locations/:id - Update location (admin/faculty only)
router.put(
  "/:id",
  requireAuth,
  requireRole(["admin", "faculty"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = updateLocationSchema.parse(req.body);

      const location = await storage.updateLocation(id, updateData);

      if (!location) {
        return res.status(404).json({ error: "Location not found" });
      }

      // Log location update
      await storage.createSystemLog(
        "info",
        `Location updated: ${location.name}`,
        "locations",
        { locationId: location.id, updatedBy: req.user.id },
      );

      res.json({ location });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ error: validationError.message });
      }

      console.error("Update location error:", error);
      res.status(500).json({ error: "Failed to update location" });
    }
  },
);

// DELETE /api/locations/:id - Deactivate location (admin only)
router.delete("/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { id } = req.params;

    // Soft delete by setting isActive to false
    const location = await storage.updateLocation(id, { isActive: false });

    if (!location) {
      return res.status(404).json({ error: "Location not found" });
    }

    // Log location deactivation
    await storage.createSystemLog(
      "info",
      `Location deactivated: ${location.name}`,
      "locations",
      { locationId: location.id, deactivatedBy: req.user.id },
    );

    res.json({ message: "Location deactivated successfully" });
  } catch (error) {
    console.error("Delete location error:", error);
    res.status(500).json({ error: "Failed to deactivate location" });
  }
});

export default router;
