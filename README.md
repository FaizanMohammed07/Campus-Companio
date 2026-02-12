# Campus Companion 🤖

A comprehensive campus navigation and assistance robot system with voice control, real-time navigation, and intelligent path planning.

## Features

- **Voice-Controlled Navigation**: Natural language voice commands for campus navigation
- **Real-Time Path Planning**: Dynamic route calculation with obstacle avoidance
- **Multi-User Authentication**: Role-based access control (Student, Faculty, Admin)
- **Location Management**: Comprehensive campus location database
- **Robot Control**: ESP32-based robot control with safety features
- **System Monitoring**: Comprehensive logging and analytics
- **Web Dashboard**: Modern React-based user interface
- **RESTful API**: Complete backend API for all operations

## Architecture

### Backend (Node.js/Express/TypeScript)

- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js with session management
- **AI Integration**: OpenRouter API for natural language processing
- **Hardware Control**: ESP32 robot control via HTTP API
- **Real-time Communication**: WebSocket support for live updates

### Frontend (React/Vite/TypeScript)

- **UI Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with Radix UI components
- **State Management**: TanStack Query for API state
- **Animations**: Framer Motion for smooth interactions
- **Voice Integration**: Web Speech API for voice input

### Hardware (ESP32)

- **Microcontroller**: ESP32 with WiFi/Bluetooth
- **Sensors**: Camera, ultrasonic sensors, IMU
- **Actuators**: Motor control, LED indicators
- **Communication**: HTTP API for control commands

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 13+
- ESP32 development board (optional for hardware features)
- OpenRouter API key

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd campus-companion
   ```

2. **Backend Setup**

   ```bash
   cd BACKEND
   npm install
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Database Setup**

   ```bash
   # Create PostgreSQL database
   createdb campus_companion

   # Run migrations
   npm run db:generate
   npm run db:migrate

   # Seed initial data
   npm run db:seed
   ```

4. **Frontend Setup**

   ```bash
   cd ../FRONTEND
   npm install
   ```

5. **ESP32 Setup** (Optional)
   ```bash
   # Upload firmware to ESP32
   cd ../FIRMWARE/esp32_campus_companion
   # Use Arduino IDE or PlatformIO to upload
   ```

### Running the Application

1. **Start Backend**

   ```bash
   cd BACKEND
   npm run dev
   ```

2. **Start Frontend** (in another terminal)

   ```bash
   cd FRONTEND
   npm run dev
   ```

3. **Access the Application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000

## API Documentation

### Authentication Endpoints

```bash
POST /api/auth/login
POST /api/auth/register
POST /api/auth/logout
GET  /api/auth/me
GET  /api/auth/status
```

### Location Management

```bash
GET    /api/locations
GET    /api/locations/:id
GET    /api/locations/category/:category
POST   /api/locations
PUT    /api/locations/:id
DELETE /api/locations/:id
```

### Navigation

```bash
GET    /api/navigation/active
GET    /api/navigation/:id
POST   /api/navigation
PUT    /api/navigation/:id
POST   /api/navigation/:id/cancel
```

### Voice Commands

```bash
POST /api/voice-command/          # Legacy voice processing
GET  /api/voice/commands          # Get voice command history
POST /api/voice/commands          # Create voice command
GET  /api/voice/stats             # Voice analytics
```

### Robot Control

```bash
GET    /api/robot/commands
POST   /api/robot/commands
PUT    /api/robot/commands/:id
POST   /api/robot/commands/:id/cancel
GET    /api/robot/status
POST   /api/robot/emergency-stop
```

## Database Schema

### Core Tables

- **users**: User accounts with roles (student, faculty, admin)
- **locations**: Campus locations with coordinates and metadata
- **navigation_sessions**: Navigation session tracking
- **voice_commands**: Voice command history and analytics
- **robot_commands**: Robot control command queue
- **system_logs**: Application logging and monitoring

## Configuration

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/campus_companion

# Security
SESSION_SECRET=your-secret-key
OPENROUTER_API_KEY=your-api-key

# Hardware
ESP32_BASE_URL=http://192.168.1.100:8080

# Server
PORT=3000
NODE_ENV=development
```

## Development

### Available Scripts

```bash
# Backend
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run check        # Type checking
npm run db:generate  # Generate migrations
npm run db:migrate   # Run migrations
npm run db:seed      # Seed database

# Frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
```

### Project Structure

```
campus-companion/
├── BACKEND/
│   ├── server/
│   │   ├── index.ts          # Server entry point
│   │   ├── routes.ts         # Route registration
│   │   ├── storage.ts        # Database storage layer
│   │   ├── routes/           # API route handlers
│   │   └── services/         # Business logic services
│   ├── shared/
│   │   └── schema.ts         # Database schema & types
│   └── drizzle.config.ts     # Database configuration
├── FRONTEND/
│   ├── client/
│   │   ├── src/
│   │   │   ├── App.tsx       # Main application
│   │   │   ├── components/   # React components
│   │   │   ├── pages/        # Page components
│   │   │   └── lib/          # Utilities
│   │   └── public/           # Static assets
│   └── vite.config.ts        # Vite configuration
├── FIRMWARE/
│   └── esp32_campus_companion/
│       └── esp32_campus_companion.ino
└── tools/                    # Development utilities
```

## Testing

### API Testing

```bash
# Health check
curl http://localhost:3000/api/health

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Voice Testing

```bash
# Test voice command
curl -X POST http://localhost:3000/api/voice-command/ \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "Take me to the library",
    "uiContext": {
      "current_page": "/",
      "available_actions": ["Visitor Help", "Faculty & Office"]
    }
  }'
```

## Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure production database
- [ ] Set secure `SESSION_SECRET`
- [ ] Enable HTTPS
- [ ] Configure CORS for production domain
- [ ] Set up monitoring and logging
- [ ] Configure ESP32 network access

### Docker Deployment

```dockerfile
# Backend Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY BACKEND/package*.json ./
RUN npm ci --only=production
COPY BACKEND/ .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support and questions:

- Create an issue on GitHub
- Check the documentation
- Review the API documentation

---

Built with ❤️ for campus navigation and accessibility
