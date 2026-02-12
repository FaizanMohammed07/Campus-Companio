import { storage } from "../server/storage";
import { config } from "dotenv";

// Load environment variables
config();

async function seedDatabase() {
  try {
    console.log("Seeding database with initial data...");

    // Create admin user
    const adminUser = await storage.createUser({
      username: "admin",
      password: "admin123", // This will be hashed
      email: "admin@campus.edu",
      role: "admin",
    });
    console.log("Created admin user:", adminUser.username);

    // Create faculty user
    const facultyUser = await storage.createUser({
      username: "faculty",
      password: "faculty123",
      email: "faculty@campus.edu",
      role: "faculty",
    });
    console.log("Created faculty user:", facultyUser.username);

    // Create sample locations
    const locations = [
      {
        name: "Main Entrance",
        code: "MAIN_ENTRANCE",
        description: "Primary entrance to the campus",
        category: "entrance",
        coordinates: { lat: 40.7128, lng: -74.006 },
        floor: "0",
        building: "Main Building",
        isActive: true,
      },
      {
        name: "Library",
        code: "LIBRARY",
        description: "Central library with study areas",
        category: "facility",
        coordinates: { lat: 40.7129, lng: -74.0061 },
        floor: "1",
        building: "Academic Center",
        isActive: true,
      },
      {
        name: "Computer Science Lab",
        code: "CS_LAB",
        description: "CS department lab with workstations",
        category: "classroom",
        coordinates: { lat: 40.713, lng: -74.0062 },
        floor: "2",
        building: "Engineering Building",
        isActive: true,
      },
      {
        name: "Cafeteria",
        code: "CAFETERIA",
        description: "Student cafeteria and dining area",
        category: "facility",
        coordinates: { lat: 40.7131, lng: -74.0063 },
        floor: "0",
        building: "Student Center",
        isActive: true,
      },
      {
        name: "Auditorium",
        code: "AUDITORIUM",
        description: "Large auditorium for events and lectures",
        category: "facility",
        coordinates: { lat: 40.7132, lng: -74.0064 },
        floor: "0",
        building: "Performing Arts Center",
        isActive: true,
      },
      {
        name: "Medical Center",
        code: "MEDICAL",
        description: "Campus health services",
        category: "facility",
        coordinates: { lat: 40.7133, lng: -74.0065 },
        floor: "1",
        building: "Health Building",
        isActive: true,
      },
    ];

    for (const location of locations) {
      await storage.createLocation(location);
      console.log("Created location:", location.name);
    }

    console.log("Database seeding completed successfully!");
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
}

seedDatabase();
