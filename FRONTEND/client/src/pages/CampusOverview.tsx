import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft,
  MapPin,
  Navigation,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Info,
} from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { motion } from "framer-motion";

const CAMPUS_LOCATIONS = [
  {
    id: "fee",
    name: "Fee Payment",
    icon: "💰",
    block: "A Block",
    position: { x: 25, y: 30 },
    color: "from-green-500 to-emerald-600",
  },
  {
    id: "admissions",
    name: "Admissions",
    icon: "📝",
    block: "Admin Block",
    position: { x: 75, y: 20 },
    color: "from-blue-500 to-indigo-600",
  },
  {
    id: "admin",
    name: "Admin Office",
    icon: "🏢",
    block: "Admin Block",
    position: { x: 70, y: 25 },
    color: "from-purple-500 to-violet-600",
  },
  {
    id: "library",
    name: "Library",
    icon: "📚",
    block: "C Block",
    position: { x: 45, y: 60 },
    color: "from-amber-500 to-orange-600",
  },
  {
    id: "exam",
    name: "Exam Center",
    icon: "📋",
    block: "B Block",
    position: { x: 20, y: 70 },
    color: "from-red-500 to-rose-600",
  },
  {
    id: "canteen",
    name: "Canteen",
    icon: "🍽️",
    block: "D Block",
    position: { x: 80, y: 75 },
    color: "from-orange-500 to-yellow-600",
  },
  {
    id: "sports",
    name: "Sports Complex",
    icon: "⚽",
    block: "Sports Area",
    position: { x: 10, y: 85 },
    color: "from-teal-500 to-cyan-600",
  },
  {
    id: "parking",
    name: "Parking Area",
    icon: "🚗",
    block: "Parking Zone",
    position: { x: 90, y: 90 },
    color: "from-gray-500 to-slate-600",
  },
  {
    id: "hostel",
    name: "Hostel",
    icon: "🏠",
    block: "Hostel Block",
    position: { x: 5, y: 15 },
    color: "from-indigo-500 to-purple-600",
  },
];

export default function CampusOverview() {
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showInfo, setShowInfo] = useState(false);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.2, 2));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.2, 0.5));
  const handleReset = () => {
    setZoom(1);
    setSelectedLocation(null);
  };

  const selectedLocationData = CAMPUS_LOCATIONS.find(
    (loc) => loc.id === selectedLocation,
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="sm" className="rounded-xl">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">
              Campus Overview
            </h1>
            <p className="text-slate-600">
              Interactive map of the entire campus
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
            className="rounded-xl"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomIn}
            disabled={zoom >= 2}
            className="rounded-xl"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="rounded-xl"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowInfo(!showInfo)}
            className="rounded-xl"
          >
            <Info className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Map Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-3"
        >
          <Card className="p-6 bg-white/80 backdrop-blur-xl border border-white/20 shadow-2xl">
            <div className="relative w-full h-[600px] bg-gradient-to-br from-green-100 to-blue-100 rounded-2xl overflow-hidden border-2 border-white/30">
              {/* Campus Map Background */}
              <div className="absolute inset-0">
                {/* Roads and Paths with animation */}
                <svg
                  className="w-full h-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  {/* Main paths with navigation animation */}
                  <path
                    d="M 0 50 L 100 50"
                    stroke="#3b82f6"
                    strokeWidth="3"
                    fill="none"
                    className="animate-pulse"
                    strokeDasharray="5,5"
                  />
                  <path
                    d="M 50 0 L 50 100"
                    stroke="#3b82f6"
                    strokeWidth="3"
                    fill="none"
                    className="animate-pulse"
                    strokeDasharray="5,5"
                  />

                  {/* Animated walking paths */}
                  <path
                    d="M 25 35 L 72.5 25"
                    stroke="#10b981"
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray="3,3"
                    className="animate-pulse"
                    opacity="0.7"
                  />
                  <path
                    d="M 47.5 70 L 17.5 85"
                    stroke="#10b981"
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray="3,3"
                    className="animate-pulse"
                    opacity="0.7"
                  />

                  {/* Building blocks with pulse animation */}
                  <rect
                    x="15"
                    y="20"
                    width="20"
                    height="15"
                    fill="#10b981"
                    stroke="#059669"
                    strokeWidth="2"
                    rx="2"
                    className="animate-pulse"
                  />
                  <rect
                    x="60"
                    y="15"
                    width="25"
                    height="20"
                    fill="#3b82f6"
                    stroke="#2563eb"
                    strokeWidth="2"
                    rx="2"
                    className="animate-pulse"
                  />
                  <rect
                    x="35"
                    y="50"
                    width="25"
                    height="20"
                    fill="#f59e0b"
                    stroke="#d97706"
                    strokeWidth="2"
                    rx="2"
                    className="animate-pulse"
                  />
                  <rect
                    x="10"
                    y="75"
                    width="15"
                    height="15"
                    fill="#ef4444"
                    stroke="#dc2626"
                    strokeWidth="2"
                    rx="2"
                    className="animate-pulse"
                  />
                  <rect
                    x="70"
                    y="70"
                    width="20"
                    height="15"
                    fill="#8b5cf6"
                    stroke="#7c3aed"
                    strokeWidth="2"
                    rx="2"
                    className="animate-pulse"
                  />

                  {/* Labels */}
                  <text
                    x="25"
                    y="32"
                    textAnchor="middle"
                    className="text-xs font-bold fill-white"
                  >
                    A Block
                  </text>
                  <text
                    x="72.5"
                    y="27"
                    textAnchor="middle"
                    className="text-xs font-bold fill-white"
                  >
                    Admin
                  </text>
                  <text
                    x="47.5"
                    y="62"
                    textAnchor="middle"
                    className="text-xs font-bold fill-white"
                  >
                    C Block
                  </text>
                  <text
                    x="17.5"
                    y="87"
                    textAnchor="middle"
                    className="text-xs font-bold fill-white"
                  >
                    Sports
                  </text>
                  <text
                    x="80"
                    y="82"
                    textAnchor="middle"
                    className="text-xs font-bold fill-white"
                  >
                    D Block
                  </text>

                  {/* Animated navigator dot */}
                  <circle
                    cx="50"
                    cy="50"
                    r="3"
                    fill="#ffffff"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    className="animate-bounce"
                  >
                    <animateMotion dur="4s" repeatCount="indefinite">
                      <path d="M 0 0 L 20 0 L 20 20 L 0 20 Z" />
                    </animateMotion>
                  </circle>
                </svg>
              </div>

              {/* Location Markers */}
              <div
                className="absolute inset-0 transition-transform duration-300 ease-out"
                style={{ transform: `scale(${zoom})` }}
              >
                {CAMPUS_LOCATIONS.map((location) => (
                  <motion.div
                    key={location.id}
                    className="absolute cursor-pointer group"
                    style={{
                      left: `${location.position.x}%`,
                      top: `${location.position.y}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() =>
                      setSelectedLocation(
                        selectedLocation === location.id ? null : location.id,
                      )
                    }
                  >
                    <div
                      className={`w-8 h-8 rounded-full bg-gradient-to-br ${location.color} flex items-center justify-center shadow-lg border-2 border-white group-hover:shadow-xl transition-all duration-300 ${selectedLocation === location.id ? "ring-4 ring-blue-400 ring-opacity-50" : ""}`}
                    >
                      <span className="text-lg filter drop-shadow-sm">
                        {location.icon}
                      </span>
                    </div>

                    {/* Location Label */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{
                        opacity: selectedLocation === location.id ? 1 : 0,
                        y: selectedLocation === location.id ? 0 : 10,
                      }}
                      className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-black/80 text-white px-3 py-1 rounded-lg text-sm font-medium whitespace-nowrap z-10"
                    >
                      {location.name}
                      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rotate-45 w-2 h-2 bg-black/80"></div>
                    </motion.div>
                  </motion.div>
                ))}
              </div>

              {/* Zoom Level Indicator */}
              <div className="absolute top-4 right-4 bg-black/60 text-white px-3 py-1 rounded-lg text-sm font-medium">
                {Math.round(zoom * 100)}%
              </div>

              {/* Navigation Status Overlay */}
              <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 text-xs">
                <div className="font-semibold mb-1 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  Live Campus View
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
                    <span>Active Navigation</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-0.5 bg-green-500 animate-pulse"></div>
                    <span>Walking Paths</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-4"
        >
          {/* Info Panel */}
          {showInfo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Card className="p-4 bg-white/80 backdrop-blur-xl border border-white/20">
                <h3 className="font-semibold text-slate-800 mb-2">
                  Map Legend
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded"></div>
                    <span>Academic Buildings</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded"></div>
                    <span>Administrative</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gradient-to-br from-purple-500 to-violet-600 rounded"></div>
                    <span>Facilities</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gradient-to-br from-amber-500 to-orange-600 rounded"></div>
                    <span>Services</span>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Selected Location Details */}
          {selectedLocationData && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="p-4 bg-white/80 backdrop-blur-xl border border-white/20">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`w-10 h-10 rounded-full bg-gradient-to-br ${selectedLocationData.color} flex items-center justify-center`}
                  >
                    <span className="text-xl">{selectedLocationData.icon}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">
                      {selectedLocationData.name}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {selectedLocationData.block}
                    </p>
                  </div>
                </div>

                <Link href="/visitor">
                  <Button className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700">
                    <Navigation className="w-4 h-4 mr-2" />
                    Get Directions
                  </Button>
                </Link>
              </Card>
            </motion.div>
          )}

          {/* Quick Stats */}
          <Card className="p-4 bg-white/80 backdrop-blur-xl border border-white/20">
            <h3 className="font-semibold text-slate-800 mb-3">Campus Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Total Buildings</span>
                <span className="font-semibold text-slate-800">10+</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Locations Mapped</span>
                <span className="font-semibold text-slate-800">9</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Total Area</span>
                <span className="font-semibold text-slate-800">50+ Acres</span>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
