import { Router } from "express";
import passport from "passport";
import { storage } from "../storage";
import { z } from "zod";
import bcrypt from "bcrypt";
import { fromZodError } from "zod-validation-error";

const router = Router();

// Validation schemas
const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Invalid email address"),
  role: z.enum(["student", "faculty", "admin"]).default("student"),
});

// Passport Local Strategy
passport.use(
  "local",
  new (await import("passport-local")).Strategy(
    {
      usernameField: "username",
      passwordField: "password",
    },
    async (username: string, password: string, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: "Invalid username or password" });
        }

        if (!user.isActive) {
          return done(null, false, { message: "Account is deactivated" });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          return done(null, false, { message: "Invalid username or password" });
        }

        // Log successful login
        await storage.createSystemLog(
          "info",
          `User ${username} logged in successfully`,
          "auth",
          { userId: user.id, role: user.role },
        );

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    },
  ),
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await storage.getUser(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

// Middleware to check if user is authenticated
export const requireAuth = (req: any, res: any, next: any) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Authentication required" });
};

// Middleware to check if user has required role
export const requireRole = (roles: string[]) => {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
};

// Routes
router.post("/login", async (req, res) => {
  try {
    const { username, password } = loginSchema.parse(req.body);

    // Use passport authenticate
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        console.error("Login error:", err);
        return res.status(500).json({ error: "Internal server error" });
      }

      if (!user) {
        return res.status(401).json({ error: info.message || "Login failed" });
      }

      req.logIn(user, (err) => {
        if (err) {
          console.error("Session login error:", err);
          return res.status(500).json({ error: "Login failed" });
        }

        // Return user info without password
        const { password: _, ...userInfo } = user;
        res.json({
          user: userInfo,
          message: "Login successful",
        });
      });
    })(req, res);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ error: validationError.message });
    }

    console.error("Login validation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/register", async (req, res) => {
  try {
    const { username, password, email, role } = registerSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      return res.status(409).json({ error: "Username already exists" });
    }

    // Check if email already exists
    const existingEmail = (await storage.getUsers()).find(
      (u) => u.email === email,
    );
    if (existingEmail) {
      return res.status(409).json({ error: "Email already exists" });
    }

    // Create new user
    const newUser = await storage.createUser({
      username,
      password,
      email,
      role,
      isActive: true,
    });

    // Log user registration
    await storage.createSystemLog(
      "info",
      `New user registered: ${username}`,
      "auth",
      { userId: newUser.id, role: newUser.role },
    );

    // Return user info without password
    const { password: _, ...userInfo } = newUser;
    res.status(201).json({
      user: userInfo,
      message: "Registration successful",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ error: validationError.message });
    }

    console.error("Registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logout", (req, res) => {
  const username = req.user?.username;

  req.logout((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ error: "Logout failed" });
    }

    // Log logout
    if (username) {
      storage
        .createSystemLog("info", `User ${username} logged out`, "auth")
        .catch(console.error);
    }

    res.json({ message: "Logout successful" });
  });
});

router.get("/me", requireAuth, (req, res) => {
  const { password: _, ...userInfo } = req.user;
  res.json({ user: userInfo });
});

router.get("/status", (req, res) => {
  res.json({
    authenticated: req.isAuthenticated(),
    user: req.user
      ? (() => {
          const { password: _, ...userInfo } = req.user;
          return userInfo;
        })()
      : null,
  });
});

export default router;
