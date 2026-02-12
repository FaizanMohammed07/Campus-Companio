import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft,
  MapPin,
  Check,
  Footprints,
  Clock,
  Phone,
  Info,
  Star,
  Navigation,
  Route,
  Timer,
  Compass,
} from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Campus Map Component (works without any API keys)
const CampusMap = ({
  selectedLocationId,
  onLocationSelect,
  isNavigating = false,
  currentStep = 0,
  totalSteps = 0,
}: {
  selectedLocationId?: string;
  onLocationSelect?: (id: string) => void;
  isNavigating?: boolean;
  currentStep?: number;
  totalSteps?: number;
}) => {
  // Calculate navigator position based on navigation progress
  const getNavigatorPosition = () => {
    if (!isNavigating || !selectedLocationId) return null;

    const location = LOCATIONS.find((loc) => loc.id === selectedLocationId);
    if (!location) return null;

    // Simple path animation - move from center towards destination
    const centerX = 200;
    const centerY = 150;
    const targetX = location.position.x * 4;
    const targetY = location.position.y * 3;

    const progress = totalSteps > 0 ? currentStep / totalSteps : 0;
    const currentX = centerX + (targetX - centerX) * progress;
    const currentY = centerY + (targetY - centerY) * progress;

    return { x: currentX, y: currentY };
  };

  const navigatorPos = getNavigatorPosition();
  return (
    <div className="relative w-full h-64 bg-gradient-to-br from-green-100 to-blue-100 rounded-xl overflow-hidden border-2 border-white/50 shadow-lg">
      {/* Campus Layout SVG */}
      <svg viewBox="0 0 400 300" className="w-full h-full">
        {/* Campus Background */}
        <rect width="400" height="300" fill="url(#campusGradient)" />

        {/* Animated Paths */}
        <g className="paths">
          <path
            d="M110 120 L225 95"
            stroke={isNavigating ? "#3b82f6" : "#6b7280"}
            strokeWidth={isNavigating ? "4" : "3"}
            fill="none"
            strokeDasharray={isNavigating ? "0" : "5,5"}
            className={isNavigating ? "animate-pulse" : ""}
          />
          <path
            d="M177 195 L82 215"
            stroke={isNavigating ? "#3b82f6" : "#6b7280"}
            strokeWidth={isNavigating ? "4" : "3"}
            fill="none"
            strokeDasharray={isNavigating ? "0" : "5,5"}
            className={isNavigating ? "animate-pulse" : ""}
          />
          <path
            d="M305 240 L40 250"
            stroke={isNavigating ? "#3b82f6" : "#6b7280"}
            strokeWidth={isNavigating ? "4" : "3"}
            fill="none"
            strokeDasharray={isNavigating ? "0" : "5,5"}
            className={isNavigating ? "animate-pulse" : ""}
          />
        </g>

        {/* Buildings with pulse animation when navigating */}
        <g className="buildings">
          <rect
            x="80"
            y="80"
            width="60"
            height="40"
            fill="#10b981"
            stroke="#059669"
            strokeWidth="2"
            rx="4"
            className={isNavigating ? "animate-pulse" : ""}
          />
          <text
            x="110"
            y="100"
            textAnchor="middle"
            className="text-xs font-bold fill-white"
          >
            A Block
          </text>

          <rect
            x="200"
            y="60"
            width="50"
            height="35"
            fill="#3b82f6"
            stroke="#2563eb"
            strokeWidth="2"
            rx="4"
            className={isNavigating ? "animate-pulse" : ""}
          />
          <text
            x="225"
            y="80"
            textAnchor="middle"
            className="text-xs font-bold fill-white"
          >
            Admin
          </text>

          <rect
            x="150"
            y="150"
            width="55"
            height="45"
            fill="#f59e0b"
            stroke="#d97706"
            strokeWidth="2"
            rx="4"
            className={isNavigating ? "animate-pulse" : ""}
          />
          <text
            x="177"
            y="175"
            textAnchor="middle"
            className="text-xs font-bold fill-white"
          >
            Library
          </text>

          <rect
            x="60"
            y="180"
            width="45"
            height="35"
            fill="#ef4444"
            stroke="#dc2626"
            strokeWidth="2"
            rx="4"
            className={isNavigating ? "animate-pulse" : ""}
          />
          <text
            x="82"
            y="200"
            textAnchor="middle"
            className="text-xs font-bold fill-white"
          >
            B Block
          </text>

          <rect
            x="280"
            y="200"
            width="50"
            height="40"
            fill="#8b5cf6"
            stroke="#7c3aed"
            strokeWidth="2"
            rx="4"
            className={isNavigating ? "animate-pulse" : ""}
          />
          <text
            x="305"
            y="225"
            textAnchor="middle"
            className="text-xs font-bold fill-white"
          >
            Sports
          </text>

          <rect
            x="20"
            y="220"
            width="40"
            height="30"
            fill="#06b6d4"
            stroke="#0891b2"
            strokeWidth="2"
            rx="4"
            className={isNavigating ? "animate-pulse" : ""}
          />
          <text
            x="40"
            y="240"
            textAnchor="middle"
            className="text-xs font-bold fill-white"
          >
            Medical
          </text>
        </g>

        {/* Location Markers with enhanced animations */}
        {LOCATIONS.map((location) => (
          <g key={location.id}>
            <circle
              cx={location.position.x * 4}
              cy={location.position.y * 3}
              r={selectedLocationId === location.id ? "12" : "8"}
              fill={selectedLocationId === location.id ? "#ef4444" : "#10b981"}
              stroke="#ffffff"
              strokeWidth="3"
              className={`cursor-pointer transition-all duration-300 ${
                selectedLocationId === location.id
                  ? "animate-ping"
                  : "hover:scale-125"
              }`}
              onClick={() => onLocationSelect?.(location.id)}
            />
            {/* Pulse ring for selected location */}
            {selectedLocationId === location.id && (
              <circle
                cx={location.position.x * 4}
                cy={location.position.y * 3}
                r="16"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2"
                opacity="0.6"
                className="animate-ping"
              />
            )}
            <text
              x={location.position.x * 4}
              y={location.position.y * 3 - 12}
              textAnchor="middle"
              className="text-xs font-bold fill-gray-800 pointer-events-none"
            >
              {location.icon}
            </text>
          </g>
        ))}

        {/* Animated Navigator/Person */}
        {navigatorPos && (
          <g className="navigator">
            {/* Walking person icon */}
            <circle
              cx={navigatorPos.x}
              cy={navigatorPos.y}
              r="6"
              fill="#ffffff"
              stroke="#3b82f6"
              strokeWidth="3"
              className="animate-bounce"
            />
            {/* Person silhouette */}
            <circle
              cx={navigatorPos.x}
              cy={navigatorPos.y - 2}
              r="2"
              fill="#3b82f6"
            />
            {/* Walking legs animation */}
            <line
              x1={navigatorPos.x - 2}
              y1={navigatorPos.y + 4}
              x2={navigatorPos.x - 1}
              y2={navigatorPos.y + 8}
              stroke="#3b82f6"
              strokeWidth="2"
              className="animate-pulse"
            />
            <line
              x1={navigatorPos.x + 2}
              y1={navigatorPos.y + 4}
              x2={navigatorPos.x + 1}
              y2={navigatorPos.y + 8}
              stroke="#3b82f6"
              strokeWidth="2"
              className="animate-pulse"
            />
          </g>
        )}

        <defs>
          <linearGradient
            id="campusGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#dcfce7" />
            <stop offset="100%" stopColor="#dbeafe" />
          </linearGradient>
          {/* Animated path gradient */}
          <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0">
              <animate
                attributeName="stop-opacity"
                values="0;1;0"
                dur="2s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="50%" stopColor="#3b82f6" stopOpacity="1">
              <animate
                attributeName="stop-opacity"
                values="1;0;1"
                dur="2s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0">
              <animate
                attributeName="stop-opacity"
                values="0;1;0"
                dur="2s"
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>
        </defs>
      </svg>

      {/* Selected Location Indicator */}
      {selectedLocationId && (
        <div className="absolute bottom-2 left-2 bg-black/80 text-white px-3 py-1 rounded-lg text-sm">
          Selected:{" "}
          {LOCATIONS.find((loc) => loc.id === selectedLocationId)?.name}
        </div>
      )}

      {/* Navigation Progress Indicator */}
      {isNavigating && totalSteps > 0 && (
        <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm rounded-lg p-2 text-xs">
          <div className="font-semibold mb-1">Navigation Progress</div>
          <div className="flex items-center gap-2">
            <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-500 ease-out"
                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium">
              {currentStep}/{totalSteps}
            </span>
          </div>
        </div>
      )}

      {/* Map Legend */}
      <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-lg p-2 text-xs">
        <div className="font-semibold mb-1">Campus Map</div>
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>Buildings</span>
          </div>
          <div className="flex items-center gap-1">
            <div
              className={`w-3 h-0.5 ${isNavigating ? "bg-blue-500 animate-pulse" : "bg-gray-500"} border-dashed`}
            ></div>
            <span>Paths {isNavigating && "(Active)"}</span>
          </div>
          {navigatorPos && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
              <span>You are here</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const LOCATIONS = [
  {
    id: "fee",
    name: "Fee Payment",
    icon: "💰",
    block: "A Block",
    position: { x: 25, y: 30 },
    distance: "150m",
    time: "2 min",
    color: "from-green-500 to-emerald-600",
    coordinates: { lat: 12.9716, lng: 77.5946 }, // Example coordinates - replace with actual campus coordinates
  },
  {
    id: "admissions",
    name: "Admissions",
    icon: "📝",
    block: "Admin Block",
    position: { x: 75, y: 20 },
    distance: "200m",
    time: "3 min",
    color: "from-blue-500 to-indigo-600",
    coordinates: { lat: 12.972, lng: 77.595 },
  },
  {
    id: "admin",
    name: "Admin Office",
    icon: "🏢",
    block: "Admin Block",
    position: { x: 70, y: 25 },
    distance: "180m",
    time: "2.5 min",
    color: "from-purple-500 to-violet-600",
    coordinates: { lat: 12.9722, lng: 77.5952 },
  },
  {
    id: "library",
    name: "Library",
    icon: "📚",
    block: "C Block",
    position: { x: 45, y: 60 },
    distance: "300m",
    time: "4 min",
    color: "from-amber-500 to-orange-600",
    coordinates: { lat: 12.971, lng: 77.594 },
  },
  {
    id: "exam",
    name: "Exam Cell",
    icon: "🧑‍💼",
    block: "B Block",
    position: { x: 35, y: 45 },
    distance: "220m",
    time: "3 min",
    color: "from-red-500 to-rose-600",
    coordinates: { lat: 12.9714, lng: 77.5944 },
  },
  {
    id: "canteen",
    name: "Canteen",
    icon: "🍽",
    block: "D Block",
    position: { x: 55, y: 75 },
    distance: "350m",
    time: "5 min",
    color: "from-pink-500 to-rose-500",
    coordinates: { lat: 12.9705, lng: 77.5935 },
  },
  {
    id: "medical",
    name: "Medical Center",
    icon: "🏥",
    block: "Health Block",
    position: { x: 15, y: 70 },
    distance: "280m",
    time: "4 min",
    color: "from-teal-500 to-cyan-600",
    coordinates: { lat: 12.9725, lng: 77.5955 },
  },
  {
    id: "sports",
    name: "Sports Complex",
    icon: "⚽",
    block: "Sports Block",
    position: { x: 85, y: 80 },
    distance: "400m",
    time: "6 min",
    color: "from-orange-500 to-red-500",
    coordinates: { lat: 12.9695, lng: 77.5925 },
  },
  {
    id: "parking",
    name: "Parking Area",
    icon: "🚗",
    block: "Parking Zone",
    position: { x: 10, y: 10 },
    distance: "50m",
    time: "1 min",
    color: "from-gray-500 to-slate-600",
    coordinates: { lat: 12.973, lng: 77.596 },
  },
];

const LOCATION_DETAILS = {
  fee: {
    title: "Fee Payment Center",
    description:
      "Complete your academic fee payments securely and conveniently",
    icon: "💰",
    color: "from-green-500 to-emerald-600",
    details: [
      {
        icon: "⏰",
        label: "Working Hours",
        value: "9:00 AM - 5:00 PM (Mon-Sat)",
      },
      { icon: "📞", label: "Contact", value: "+91-123-456-7890" },
      {
        icon: "💳",
        label: "Payment Methods",
        value: "Cash, Card, UPI, Online",
      },
      { icon: "🏢", label: "Location", value: "Ground Floor, A Block" },
    ],
    facilities: [
      "Online Payment Portal",
      "Receipt Generation",
      "Multiple Counters",
      "Student Support",
    ],
    important:
      "Please bring your student ID and fee receipt for smooth processing.",
  },
  admissions: {
    title: "Admissions Office",
    description: "Your gateway to joining our academic community",
    icon: "📝",
    color: "from-blue-500 to-indigo-600",
    details: [
      {
        icon: "⏰",
        label: "Working Hours",
        value: "9:00 AM - 4:00 PM (Mon-Fri)",
      },
      { icon: "📞", label: "Contact", value: "+91-123-456-7891" },
      {
        icon: "📋",
        label: "Services",
        value: "New Admissions, Document Verification",
      },
      { icon: "🏢", label: "Location", value: "Admin Block, Room 101" },
    ],
    facilities: [
      "Counseling Services",
      "Document Processing",
      "Information Desk",
      "Student Orientation",
    ],
    important: "Bring all required documents and previous academic records.",
  },
  admin: {
    title: "Administration Office",
    description: "Central administrative services and student support",
    icon: "🏢",
    color: "from-purple-500 to-violet-600",
    details: [
      {
        icon: "⏰",
        label: "Working Hours",
        value: "8:30 AM - 5:30 PM (Mon-Sat)",
      },
      { icon: "📞", label: "Contact", value: "+91-123-456-7892" },
      {
        icon: "📄",
        label: "Services",
        value: "Certificates, Transcripts, Complaints",
      },
      { icon: "🏢", label: "Location", value: "Admin Block, Ground Floor" },
    ],
    facilities: [
      "Student Services",
      "Administrative Support",
      "Document Issuance",
      "Information Center",
    ],
    important:
      "Please have your student ID ready for all administrative services.",
  },
  library: {
    title: "Central Library",
    description:
      "A hub of knowledge with extensive collection of books and digital resources",
    icon: "📚",
    color: "from-amber-500 to-orange-600",
    details: [
      {
        icon: "⏰",
        label: "Working Hours",
        value: "8:00 AM - 8:00 PM (Mon-Sat)",
      },
      { icon: "📞", label: "Contact", value: "+91-123-456-7893" },
      {
        icon: "📖",
        label: "Collection",
        value: "50,000+ Books, Journals, Digital Resources",
      },
      { icon: "🏢", label: "Location", value: "C Block, Entire Building" },
    ],
    facilities: [
      "Reading Areas",
      "Computer Lab",
      "Study Rooms",
      "Research Assistance",
    ],
    important:
      "Library membership card required. Silence and mobile phones not allowed in reading areas.",
  },
  exam: {
    title: "Examination Cell",
    description: "Managing all examination processes and academic assessments",
    icon: "🧑‍💼",
    color: "from-red-500 to-rose-600",
    details: [
      {
        icon: "⏰",
        label: "Working Hours",
        value: "9:00 AM - 5:00 PM (Mon-Fri)",
      },
      { icon: "📞", label: "Contact", value: "+91-123-456-7894" },
      {
        icon: "📝",
        label: "Services",
        value: "Hall Tickets, Results, Revaluation",
      },
      { icon: "🏢", label: "Location", value: "B Block, First Floor" },
    ],
    facilities: [
      "Exam Registration",
      "Result Processing",
      "Certificate Verification",
      "Academic Counseling",
    ],
    important:
      "Important exam dates and hall ticket information available here.",
  },
  canteen: {
    title: "Campus Canteen",
    description: "Fresh, hygienic food and beverages for students and staff",
    icon: "🍽",
    color: "from-pink-500 to-rose-500",
    details: [
      {
        icon: "⏰",
        label: "Working Hours",
        value: "7:00 AM - 7:00 PM (Mon-Sat)",
      },
      { icon: "📞", label: "Contact", value: "+91-123-456-7895" },
      { icon: "🍽", label: "Services", value: "Meals, Snacks, Beverages" },
      { icon: "🏢", label: "Location", value: "D Block, Ground Floor" },
    ],
    facilities: [
      "Fresh Food",
      "Clean Environment",
      "Multiple Counters",
      "Seating Areas",
    ],
    important: "Please maintain queue discipline and keep the area clean.",
  },
  medical: {
    title: "Medical Center",
    description: "Healthcare services for students, faculty, and staff",
    icon: "🏥",
    color: "from-teal-500 to-cyan-600",
    details: [
      {
        icon: "⏰",
        label: "Working Hours",
        value: "8:00 AM - 6:00 PM (Mon-Sat)",
      },
      { icon: "📞", label: "Contact", value: "+91-123-456-7896" },
      {
        icon: "⚕️",
        label: "Services",
        value: "First Aid, Consultation, Emergency Care",
      },
      { icon: "🏢", label: "Location", value: "Health Block, Ground Floor" },
    ],
    facilities: [
      "Medical Consultation",
      "First Aid Station",
      "Pharmacy",
      "Emergency Room",
    ],
    important:
      "For emergencies, call the medical center directly or use the emergency hotline.",
  },
  sports: {
    title: "Sports Complex",
    description:
      "State-of-the-art sports facilities for physical education and recreation",
    icon: "⚽",
    color: "from-orange-500 to-red-500",
    details: [
      {
        icon: "⏰",
        label: "Working Hours",
        value: "6:00 AM - 8:00 PM (Mon-Sat)",
      },
      { icon: "📞", label: "Contact", value: "+91-123-456-7897" },
      {
        icon: "🏃",
        label: "Facilities",
        value: "Gym, Courts, Fields, Swimming Pool",
      },
      { icon: "🏢", label: "Location", value: "Sports Block, Multiple Venues" },
    ],
    facilities: [
      "Basketball Courts",
      "Football Field",
      "Swimming Pool",
      "Fitness Center",
    ],
    important:
      "Sports equipment available for rent. Please wear appropriate attire for activities.",
  },
  parking: {
    title: "Parking Area",
    description: "Secure parking facilities for vehicles and bicycles",
    icon: "🚗",
    color: "from-gray-500 to-slate-600",
    details: [
      { icon: "⏰", label: "Working Hours", value: "24/7 Access" },
      { icon: "📞", label: "Contact", value: "+91-123-456-7898" },
      { icon: "🅿️", label: "Services", value: "Vehicle Parking, Bike Stands" },
      { icon: "🏢", label: "Location", value: "Parking Zone, Campus Entrance" },
    ],
    facilities: [
      "Covered Parking",
      "Security Cameras",
      "Bike Racks",
      "24/7 Access",
    ],
    important:
      "Please park in designated areas only. Vehicles parked improperly may be towed.",
  },
};

export default function VisitorHelp() {
  const [isGuiding, setIsGuiding] = useState(false);
  const [destinationLocal, setDestinationLocal] = useState<string | null>(null);
  const [directionsLocal, setDirectionsLocal] = useState<string[] | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<
    (typeof LOCATIONS)[0] | null
  >(null);
  const [navigationStep, setNavigationStep] = useState(0);
  const [totalNavigationSteps, setTotalNavigationSteps] = useState(0);

  const handleSelect = (loc: (typeof LOCATIONS)[0]) => {
    setSelectedLocation(loc);
  };

  const handleShowDirections = () => {
    if (selectedLocation) {
      setDestinationLocal(mapIdToTarget(selectedLocation.id));
      setDirectionsLocal(getDirectionsForId(selectedLocation.id));
      setSelectedLocation(null);
    }
  };

  const handleStartGuide = () => {
    setIsGuiding(true);
    setNavigationStep(0);
    setTotalNavigationSteps(10); // Simulate 10 steps for navigation

    // Simulate navigation progress
    const interval = setInterval(() => {
      setNavigationStep((prev) => {
        const next = prev + 1;
        if (next >= 10) {
          clearInterval(interval);
          // Navigation complete - could add completion animation here
          setTimeout(() => {
            setIsGuiding(false);
            setNavigationStep(0);
            setTotalNavigationSteps(0);
          }, 2000);
        }
        return next;
      });
    }, 800); // Update every 800ms for smooth animation
  };

  const showDirections = directionsLocal && destinationLocal;

  const destinationLabel = (() => {
    switch (destinationLocal) {
      case "A_BLOCK":
        return "A Block";
      case "B_BLOCK":
        return "B Block";
      case "ADMISSION":
        return "Admissions";
      case "FEE":
        return "Fee Payment";
      default:
        return "Destination";
    }
  })();

  if (selectedLocation) {
    const details =
      LOCATION_DETAILS[selectedLocation.id as keyof typeof LOCATION_DETAILS];
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-200/30 to-purple-200/30 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-pink-200/30 to-orange-200/30 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>

        <div className="relative z-10 max-w-2xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 mb-8"
          >
            <Button
              variant="outline"
              size="icon"
              className="rounded-full border-2"
              onClick={() => setSelectedLocation(null)}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1" />
          </motion.div>

          {/* Main Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            {/* Hero Section */}
            <div
              className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${details.color} p-8 text-white shadow-2xl`}
            >
              <div className="absolute inset-0 bg-black/10" />
              <div className="relative z-10">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  className="text-center mb-6"
                >
                  <div className="text-8xl mb-4 filter drop-shadow-lg">
                    {details.icon}
                  </div>
                  <h1 className="text-3xl font-bold mb-2">{details.title}</h1>
                  <p className="text-lg opacity-90">{details.description}</p>
                </motion.div>
              </div>
            </div>

            {/* Details Grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {details.details.map((detail, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{detail.icon}</span>
                    <span className="font-semibold text-gray-700">
                      {detail.label}
                    </span>
                  </div>
                  <p className="text-gray-600 ml-9">{detail.value}</p>
                </motion.div>
              ))}
            </motion.div>

            {/* Facilities */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
            >
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500" />
                Available Facilities
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {details.facilities.map((facility, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.7 + index * 0.05 }}
                    className="flex items-center gap-2 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl"
                  >
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium">{facility}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Important Information */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-200"
            >
              <div className="flex items-start gap-3">
                <Info className="w-6 h-6 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-bold text-amber-800 mb-2">
                    Important Information
                  </h3>
                  <p className="text-amber-700">{details.important}</p>
                </div>
              </div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="flex flex-col gap-4"
            >
              <Button
                size="lg"
                className="w-full rounded-2xl h-14 text-lg font-semibold shadow-lg hover:shadow-xl transition-all bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                onClick={handleShowDirections}
              >
                <MapPin className="w-5 h-5 mr-2" />
                Show Directions
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full rounded-2xl h-14 text-lg font-semibold border-2 hover:bg-gray-50"
                onClick={() => setSelectedLocation(null)}
              >
                Back to Locations
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  if (isGuiding) {
    return (
      <div className="min-h-screen flex flex-col bg-primary text-primary-foreground relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent scale-150 animate-pulse" />
        </div>

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex-1 flex flex-col relative z-10 p-4"
        >
          {/* Header */}
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="secondary"
              size="icon"
              className="rounded-full bg-white/20 hover:bg-white/30"
              onClick={() => {
                setIsGuiding(false);
              }}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Navigation Active</h1>
              <p className="text-lg opacity-90">
                Heading to {destinationLabel}
              </p>
            </div>
          </div>

          {/* Campus Map Container */}
          <div className="flex-1 rounded-2xl overflow-hidden shadow-2xl mb-4">
            <CampusMap
              selectedLocationId={destinationLocal?.toLowerCase()}
              isNavigating={isGuiding}
              currentStep={navigationStep}
              totalSteps={totalNavigationSteps}
            />
          </div>

          {/* Navigation Info */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-white/10 backdrop-blur-xl rounded-2xl p-4"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Navigation className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Campus Navigation</h3>
                <p className="text-sm opacity-90">
                  Follow the highlighted route on campus map
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-white/10 rounded-xl p-3">
                <Route className="w-5 h-5 mx-auto mb-1 text-white" />
                <p className="text-xs opacity-80">Walking Route</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <Timer className="w-5 h-5 mx-auto mb-1 text-white" />
                <p className="text-xs opacity-80">Real-time Updates</p>
              </div>
            </div>
          </motion.div>
        </motion.div>

        <Button
          variant="secondary"
          className="absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full px-8 py-6 text-lg shadow-lg bg-white/20 hover:bg-white/30"
          onClick={() => {
            setIsGuiding(false);
          }}
        >
          End Navigation
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6 max-w-lg mx-auto flex flex-col relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-32 h-32 bg-gradient-to-br from-blue-200/20 to-purple-200/20 rounded-full blur-2xl animate-pulse" />
        <div className="absolute bottom-40 left-10 w-24 h-24 bg-gradient-to-br from-pink-200/20 to-orange-200/20 rounded-full blur-2xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-gradient-to-br from-indigo-200/10 to-cyan-200/10 rounded-full blur-3xl animate-pulse delay-500" />
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 mb-8 relative z-10"
      >
        <Link href="/">
          <Button
            variant="outline"
            size="icon"
            className="rounded-full h-12 w-12 border-2 shadow-lg hover:shadow-xl transition-all bg-white/80 backdrop-blur-sm"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div className="flex-1">
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
          >
            Campus Navigator
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="text-muted-foreground font-medium"
          >
            Where can I take you today?
          </motion.p>
        </div>
      </motion.div>

      {/* Directions panel (voice: directions first) */}
      {showDirections ? (
        <Card className="rounded-2xl p-4 mb-6 border-primary/20 bg-primary/5">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-foreground">
              Directions to {destinationLabel}
            </h2>
          </div>

          {/* Campus Map Preview */}
          <div className="mb-4">
            <CampusMap
              selectedLocationId={selectedLocation?.id}
              onLocationSelect={handleSelect}
              isNavigating={isGuiding}
              currentStep={navigationStep}
              totalSteps={totalNavigationSteps}
            />
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Campus Map Navigation
            </p>
          </div>

          <ol className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground mb-4">
            {directionsLocal?.map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
          </ol>

          <div className="flex gap-3">
            <Button
              className="rounded-xl flex-1"
              onClick={() => handleStartGuide()}
            >
              Start Campus Navigation
            </Button>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setDestinationLocal(null);
                setDirectionsLocal(null);
              }}
            >
              Close Directions
            </Button>
          </div>
        </Card>
      ) : null}

      {/* Perfect 3x3 Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-3 gap-4 max-w-4xl mx-auto relative z-10"
      >
        {LOCATIONS.map((loc, index) => (
          <motion.button
            key={loc.id}
            initial={{ opacity: 0, scale: 0.8, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
              delay: 0.4 + index * 0.08,
              type: "spring",
              stiffness: 250,
              damping: 25,
            }}
            whileHover={{
              scale: 1.05,
              y: -5,
              rotateY: 2,
              transition: { type: "spring", stiffness: 350, damping: 20 },
            }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleSelect(loc)}
            className="group relative overflow-hidden flex flex-col items-center justify-center p-4 bg-gradient-to-br from-white/95 to-white/80 backdrop-blur-xl border border-white/40 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 aspect-square gap-2 text-center hover:border-blue-400/60 hover:bg-gradient-to-br hover:from-blue-50/90 hover:to-purple-50/80"
            data-testid={`btn-loc-${loc.id}`}
          >
            {/* Premium background effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/3 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl" />

            {/* Animated border glow */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-400/30 via-purple-400/30 to-pink-400/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm scale-110" />

            {/* Icon with premium animation */}
            <motion.span
              className="text-3xl sm:text-4xl filter drop-shadow-lg relative z-10"
              whileHover={{
                scale: 1.2,
                rotate: [0, -10, 10, -5, 5, 0],
                transition: { duration: 0.5, ease: "easeInOut" },
              }}
            >
              {loc.icon}
            </motion.span>

            {/* Text content with premium typography */}
            <div className="relative z-10 w-full">
              <span className="font-bold text-sm text-gray-800 group-hover:text-blue-700 transition-colors duration-300 leading-tight block">
                {loc.name}
              </span>
              <div className="flex items-center justify-center gap-1 mt-1">
                <MapPin className="w-3 h-3 text-gray-500 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                <span className="text-xs text-gray-600 group-hover:text-blue-600 transition-colors font-medium truncate">
                  {loc.block}
                </span>
              </div>
            </div>

            {/* Multiple shine effects */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-800 rounded-2xl" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/20 to-transparent translate-y-full group-hover:-translate-y-full transition-transform duration-1000 delay-100 rounded-2xl" />

            {/* Floating particles effect */}
            <div className="absolute inset-0 overflow-hidden rounded-2xl">
              {[...Array(4)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 bg-gradient-to-r from-blue-400/40 to-purple-400/40 rounded-full"
                  initial={{
                    x: Math.random() * 100 + "%",
                    y: Math.random() * 100 + "%",
                    opacity: 0,
                  }}
                  whileHover={{
                    opacity: [0, 1, 0],
                    scale: [0, 1.2, 0],
                    transition: {
                      duration: 1.5,
                      delay: i * 0.2,
                      repeat: Infinity,
                    },
                  }}
                />
              ))}
            </div>

            {/* Premium corner accent */}
            <div className="absolute top-2 right-2 w-2 h-2 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}

function getCoordinatesForId(id: string) {
  const location = LOCATIONS.find((loc) => loc.id === id);
  return location ? location.coordinates : { lat: 12.9716, lng: 77.5946 };
}

function mapIdToTarget(id: string) {
  switch (id) {
    case "fee":
      return "FEE";
    case "admissions":
      return "ADMISSION";
    case "admin":
      return "ADMISSION";
    case "library":
      return "A_BLOCK";
    case "exam":
      return "B_BLOCK";
    case "medical":
      return "MEDICAL";
    case "sports":
      return "SPORTS";
    default:
      return "NONE";
  }
}

function getDirectionsForId(id: string): string[] {
  switch (id) {
    case "fee":
      return [
        "Go to the main academic corridor.",
        "Follow the campus signboards for A Block.",
        "At the junction, take the route marked A Block and continue straight.",
      ];
    case "admissions":
      return [
        "Go to the Admin Block / Front Office area.",
        "Look for the Admissions counter signage.",
        "If needed, ask the reception desk for Admissions.",
      ];
    case "library":
      return [
        "Head towards C Block following the main walkway.",
        "Look for the library sign near the central quad.",
        "Enter the building and proceed to the reception.",
      ];
    case "exam":
      return [
        "Proceed to B Block via the east corridor.",
        "The Exam Cell is located on the first floor.",
        "Follow the signage for B Block and take the stairs.",
      ];
    case "medical":
      return [
        "Head towards the Health Block from the main entrance.",
        "Follow the medical center signage along the pathway.",
        "The center is located on the ground floor of Health Block.",
      ];
    case "sports":
      return [
        "Take the pathway towards the Sports Complex.",
        "Follow the sports facility signs from the central quad.",
        "The main entrance is clearly marked with sports equipment icons.",
      ];
    default:
      return ["Follow campus signage to reach your destination."];
  }
}
