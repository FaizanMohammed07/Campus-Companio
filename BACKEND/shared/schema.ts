import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  jsonb,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Users table for authentication
export const users = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"), // admin, faculty, student
  email: text("email"),
  fullName: text("full_name"),
  isActive: boolean("is_active").notNull().default(true),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at")
    .notNull()
    .default(sql`now()`),
});

// Campus locations
export const locations = pgTable("locations", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  building: text("building"),
  floor: text("floor"),
  coordinates: jsonb("coordinates"), // { lat: number, lng: number }
  position: jsonb("position"), // { x: number, y: number } for map
  category: text("category").notNull(), // academic, facility, service, etc.
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at")
    .notNull()
    .default(sql`now()`),
});

// Navigation sessions
export const navigationSessions = pgTable("navigation_sessions", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id),
  startLocation: uuid("start_location").references(() => locations.id),
  endLocation: uuid("end_location").references(() => locations.id),
  status: text("status").notNull().default("active"), // active, completed, cancelled
  startedAt: timestamp("started_at")
    .notNull()
    .default(sql`now()`),
  completedAt: timestamp("completed_at"),
  duration: integer("duration"), // in seconds
  path: jsonb("path"), // array of location IDs
  feedback: jsonb("feedback"), // user feedback
});

// Voice commands log
export const voiceCommands = pgTable("voice_commands", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id),
  transcript: text("transcript").notNull(),
  intent: text("intent"),
  confidence: integer("confidence"),
  response: text("response"),
  success: boolean("success").notNull().default(true),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
});

// Robot status and commands
export const robotCommands = pgTable("robot_commands", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  command: text("command").notNull(),
  parameters: jsonb("parameters"),
  status: text("status").notNull().default("pending"), // pending, executing, completed, failed
  userId: uuid("user_id").references(() => users.id),
  sessionId: uuid("session_id").references(() => navigationSessions.id),
  response: jsonb("response"),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
  executedAt: timestamp("executed_at"),
});

// System logs
export const systemLogs = pgTable("system_logs", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  level: text("level").notNull(), // error, warn, info, debug
  message: text("message").notNull(),
  service: text("service").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
});

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
  email: true,
  fullName: true,
});

export const selectUserSchema = createSelectSchema(users);

export const insertLocationSchema = createInsertSchema(locations);
export const selectLocationSchema = createSelectSchema(locations);

export const insertNavigationSessionSchema =
  createInsertSchema(navigationSessions);
export const selectNavigationSessionSchema =
  createSelectSchema(navigationSessions);

export const insertVoiceCommandSchema = createInsertSchema(voiceCommands);
export const selectVoiceCommandSchema = createSelectSchema(voiceCommands);

export const insertRobotCommandSchema = createInsertSchema(robotCommands);
export const selectRobotCommandSchema = createSelectSchema(robotCommands);

// Type exports
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = z.infer<typeof selectUserSchema>;

export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = z.infer<typeof selectLocationSchema>;

export type InsertNavigationSession = z.infer<
  typeof insertNavigationSessionSchema
>;
export type NavigationSession = z.infer<typeof selectNavigationSessionSchema>;

export type InsertVoiceCommand = z.infer<typeof insertVoiceCommandSchema>;
export type VoiceCommand = z.infer<typeof selectVoiceCommandSchema>;

export type InsertRobotCommand = z.infer<typeof insertRobotCommandSchema>;
export type RobotCommand = z.infer<typeof selectRobotCommandSchema>;
