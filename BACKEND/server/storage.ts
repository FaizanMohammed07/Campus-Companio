import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  users,
  locations,
  navigationSessions,
  voiceCommands,
  robotCommands,
  systemLogs,
  type User,
  type InsertUser,
  type Location,
  type InsertLocation,
  type NavigationSession,
  type InsertNavigationSession,
  type VoiceCommand,
  type InsertVoiceCommand,
  type RobotCommand,
  type InsertRobotCommand,
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import bcrypt from "bcrypt";

// Database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client);

// Storage interface
export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  getUsers(): Promise<User[]>;

  // Location operations
  getLocation(id: string): Promise<Location | undefined>;
  getLocations(): Promise<Location[]>;
  getLocationsByCategory(category: string): Promise<Location[]>;
  createLocation(location: InsertLocation): Promise<Location>;
  updateLocation(
    id: string,
    updates: Partial<Location>,
  ): Promise<Location | undefined>;

  // Navigation sessions
  createNavigationSession(
    session: InsertNavigationSession,
  ): Promise<NavigationSession>;
  updateNavigationSession(
    id: string,
    updates: Partial<NavigationSession>,
  ): Promise<NavigationSession | undefined>;
  getNavigationSession(id: string): Promise<NavigationSession | undefined>;
  getActiveNavigationSessions(): Promise<NavigationSession[]>;

  // Voice commands
  createVoiceCommand(command: InsertVoiceCommand): Promise<VoiceCommand>;
  getVoiceCommands(limit?: number): Promise<VoiceCommand[]>;

  // Robot commands
  createRobotCommand(command: InsertRobotCommand): Promise<RobotCommand>;
  updateRobotCommand(
    id: string,
    updates: Partial<RobotCommand>,
  ): Promise<RobotCommand | undefined>;
  getRobotCommands(status?: string): Promise<RobotCommand[]>;

  // System logs
  createSystemLog(
    level: string,
    message: string,
    service: string,
    metadata?: any,
  ): Promise<void>;
  getSystemLogs(limit?: number): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const result = await db
      .insert(users)
      .values({ ...insertUser, password: hashedPassword })
      .returning();
    return result[0];
  }

  async updateUser(
    id: string,
    updates: Partial<User>,
  ): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({ ...updates, updatedAt: sql`now()` })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getLocation(id: string): Promise<Location | undefined> {
    const result = await db
      .select()
      .from(locations)
      .where(eq(locations.id, id))
      .limit(1);
    return result[0];
  }

  async getLocations(): Promise<Location[]> {
    return await db
      .select()
      .from(locations)
      .where(eq(locations.isActive, true))
      .orderBy(locations.name);
  }

  async getLocationsByCategory(category: string): Promise<Location[]> {
    return await db
      .select()
      .from(locations)
      .where(
        and(eq(locations.category, category), eq(locations.isActive, true)),
      )
      .orderBy(locations.name);
  }

  async createLocation(insertLocation: InsertLocation): Promise<Location> {
    const result = await db
      .insert(locations)
      .values(insertLocation)
      .returning();
    return result[0];
  }

  async updateLocation(
    id: string,
    updates: Partial<Location>,
  ): Promise<Location | undefined> {
    const result = await db
      .update(locations)
      .set({ ...updates, updatedAt: sql`now()` })
      .where(eq(locations.id, id))
      .returning();
    return result[0];
  }

  async createNavigationSession(
    session: InsertNavigationSession,
  ): Promise<NavigationSession> {
    const result = await db
      .insert(navigationSessions)
      .values(session)
      .returning();
    return result[0];
  }

  async updateNavigationSession(
    id: string,
    updates: Partial<NavigationSession>,
  ): Promise<NavigationSession | undefined> {
    const result = await db
      .update(navigationSessions)
      .set(updates)
      .where(eq(navigationSessions.id, id))
      .returning();
    return result[0];
  }

  async getNavigationSession(
    id: string,
  ): Promise<NavigationSession | undefined> {
    const result = await db
      .select()
      .from(navigationSessions)
      .where(eq(navigationSessions.id, id))
      .limit(1);
    return result[0];
  }

  async getActiveNavigationSessions(): Promise<NavigationSession[]> {
    return await db
      .select()
      .from(navigationSessions)
      .where(eq(navigationSessions.status, "active"))
      .orderBy(desc(navigationSessions.startedAt));
  }

  async createVoiceCommand(command: InsertVoiceCommand): Promise<VoiceCommand> {
    const result = await db.insert(voiceCommands).values(command).returning();
    return result[0];
  }

  async getVoiceCommands(limit: number = 50): Promise<VoiceCommand[]> {
    return await db
      .select()
      .from(voiceCommands)
      .orderBy(desc(voiceCommands.createdAt))
      .limit(limit);
  }

  async createRobotCommand(command: InsertRobotCommand): Promise<RobotCommand> {
    const result = await db.insert(robotCommands).values(command).returning();
    return result[0];
  }

  async updateRobotCommand(
    id: string,
    updates: Partial<RobotCommand>,
  ): Promise<RobotCommand | undefined> {
    const result = await db
      .update(robotCommands)
      .set({
        ...updates,
        executedAt: updates.status === "completed" ? sql`now()` : undefined,
      })
      .where(eq(robotCommands.id, id))
      .returning();
    return result[0];
  }

  async getRobotCommands(status?: string): Promise<RobotCommand[]> {
    const query = db
      .select()
      .from(robotCommands)
      .orderBy(desc(robotCommands.createdAt));
    if (status) {
      return await query.where(eq(robotCommands.status, status));
    }
    return await query;
  }

  async createSystemLog(
    level: string,
    message: string,
    service: string,
    metadata?: any,
  ): Promise<void> {
    await db.insert(systemLogs).values({
      level,
      message,
      service,
      metadata,
    });
  }

  async getSystemLogs(limit: number = 100): Promise<any[]> {
    return await db
      .select()
      .from(systemLogs)
      .orderBy(desc(systemLogs.createdAt))
      .limit(limit);
  }
}

// Initialize storage based on environment
export const storage = new DatabaseStorage();
