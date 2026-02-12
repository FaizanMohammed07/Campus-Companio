import { RobotFace } from "@/components/RobotFace";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  GraduationCap,
  Package,
  Info,
  Sparkles,
  Zap,
  Shield,
  MapPin,
  Users,
  Camera,
  ArrowRight,
} from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";

export default function Home() {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.5,
      },
    },
  };

  const item = {
    hidden: { y: 50, opacity: 0, scale: 0.8 },
    show: {
      y: 0,
      opacity: 1,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 150,
        damping: 15,
      },
    },
  };

  return (
    <div className="relative w-full min-h-screen flex flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Enhanced Dynamic Background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_30%,rgba(59,130,246,0.08),transparent_50%)]" />
        <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_80%_70%,rgba(147,51,234,0.08),transparent_50%)]" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-cyan-200/10 to-purple-200/10 rounded-full blur-3xl animate-pulse" />

        {/* Animated Grid Pattern */}
        <div className="absolute inset-0 opacity-30">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `
              linear-gradient(rgba(59,130,246,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(59,130,246,0.1) 1px, transparent 1px)
            `,
              backgroundSize: "50px 50px",
            }}
          />
        </div>
      </div>

      {/* Floating Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-gradient-to-r from-blue-400/30 to-purple-400/30 rounded-full blur-sm"
            initial={{
              x:
                Math.random() *
                (typeof window !== "undefined" ? window.innerWidth : 1920),
              y:
                Math.random() *
                (typeof window !== "undefined" ? window.innerHeight : 1080),
              opacity: 0,
            }}
            animate={{
              y: [null, -100, null],
              x: [null, Math.random() * 100 - 50, null],
              opacity: [0, 0.8, 0],
              scale: [0.3, 1, 0.3],
              transition: {
                duration: Math.random() * 15 + 10,
                repeat: Infinity,
                delay: Math.random() * 10,
              },
            }}
          />
        ))}
      </div>

      {/* Main Content Container */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* TOP HALF: BIG AI BOT SECTION */}
        <div className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="max-w-6xl w-full">
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="text-center"
            >
              {/* Massive AI Bot Display */}
              <div className="relative mb-8">
                {/* Multiple Glow Layers */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-500/20 blur-3xl rounded-full scale-200 animate-pulse" />
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-300/15 to-pink-400/15 blur-2xl rounded-full scale-150 animate-pulse delay-1000" />
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-400/10 to-violet-500/10 blur-xl rounded-full scale-125 animate-pulse delay-2000" />

                {/* Main Robot Face Container */}
                <motion.div
                  animate={{
                    rotate: [0, 5, -5, 0],
                    scale: [1, 1.05, 1],
                    y: [0, -10, 0],
                  }}
                  transition={{
                    duration: 12,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="relative"
                >
                  <div className="relative inline-block p-8 bg-gradient-to-br from-white/20 to-white/10 backdrop-blur-xl rounded-full border border-white/30 shadow-2xl">
                    <RobotFace className="w-48 h-48 md:w-64 md:h-64 lg:w-80 lg:h-80 drop-shadow-2xl filter brightness-110" />

                    {/* Animated Rings Around Robot */}
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 20,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="absolute inset-0 rounded-full border-2 border-gradient-to-r from-blue-400/30 to-purple-400/30"
                    />
                    <motion.div
                      animate={{ rotate: -360 }}
                      transition={{
                        duration: 15,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="absolute inset-2 rounded-full border border-gradient-to-r from-cyan-400/20 to-pink-400/20"
                    />
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 25,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="absolute inset-4 rounded-full border border-gradient-to-r from-indigo-400/15 to-violet-400/15"
                    />
                  </div>
                </motion.div>

                {/* Floating Tech Elements */}
                <div className="absolute -top-8 -left-8 w-16 h-16 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/20">
                  <motion.div
                    animate={{ rotate: [0, 360] }}
                    transition={{
                      duration: 8,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  >
                    <Zap className="w-8 h-8 text-blue-600" />
                  </motion.div>
                </div>

                <div className="absolute -bottom-8 -right-8 w-16 h-16 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/20">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    <Sparkles className="w-8 h-8 text-purple-600" />
                  </motion.div>
                </div>

                <div className="absolute top-1/2 -left-16 w-12 h-12 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/20">
                  <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Camera className="w-6 h-6 text-cyan-600" />
                  </motion.div>
                </div>

                <div className="absolute top-1/2 -right-16 w-12 h-12 bg-gradient-to-br from-pink-500/20 to-rose-500/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/20">
                  <motion.div
                    animate={{ x: [0, 3, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <MapPin className="w-6 h-6 text-pink-600" />
                  </motion.div>
                </div>
              </div>

              {/* Title and Subtitle */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.8 }}
                className="space-y-4"
              >
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent leading-tight">
                  Campus Companion
                </h1>
                <p className="text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
                  Your intelligent AI guide for seamless campus navigation and
                  comprehensive assistance
                </p>

                {/* AI Status Indicators */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.8 }}
                  className="flex justify-center items-center gap-6 mt-8"
                >
                  <div className="flex items-center gap-2 bg-green-50/80 backdrop-blur-sm px-4 py-2 rounded-full border border-green-200/50">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium text-green-700">
                      AI Active
                    </span>
                  </div>
                  <div className="flex items-center gap-2 bg-blue-50/80 backdrop-blur-sm px-4 py-2 rounded-full border border-blue-200/50">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium text-blue-700">
                      Navigation Ready
                    </span>
                  </div>
                  <div className="flex items-center gap-2 bg-purple-50/80 backdrop-blur-sm px-4 py-2 rounded-full border border-purple-200/50">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium text-purple-700">
                      24/7 Support
                    </span>
                  </div>
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* BOTTOM HALF: CLEAR FEATURE OPTIONS */}
        <div className="bg-white/80 backdrop-blur-xl border-t border-white/20">
          <div className="max-w-7xl mx-auto px-4 py-12">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
                Choose Your Service
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Select from our comprehensive range of campus services designed
                to enhance your experience
              </p>
            </motion.div>

            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {/* Visitor Help Card */}
              <Link href="/visitor">
                <motion.div
                  variants={item}
                  whileHover={{ scale: 1.05, y: -8 }}
                  whileTap={{ scale: 0.95 }}
                  className="group relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/50 rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer h-full"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl" />
                  <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-400/20 to-indigo-400/20 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />

                  <div className="relative z-10 space-y-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                      <GraduationCap className="w-8 h-8 text-white" />
                    </div>

                    <div>
                      <h3 className="text-xl font-bold text-slate-800 group-hover:text-blue-700 transition-colors duration-300 mb-2">
                        Visitor Help
                      </h3>
                      <p className="text-slate-600 group-hover:text-blue-600 transition-colors duration-300 text-sm leading-relaxed">
                        Complete campus navigation with interactive maps,
                        location guides, and real-time assistance for visitors
                        and guests.
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs font-medium text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                        Navigation
                      </span>
                      <ArrowRight className="w-5 h-5 text-blue-500 group-hover:translate-x-1 transition-transform duration-300" />
                    </div>
                  </div>

                  {/* Animated border */}
                  <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-blue-300/50 transition-colors duration-500" />
                </motion.div>
              </Link>

              {/* Faculty Access Card */}
              <Link href="/faculty">
                <motion.div
                  variants={item}
                  whileHover={{ scale: 1.05, y: -8 }}
                  whileTap={{ scale: 0.95 }}
                  className="group relative overflow-hidden bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200/50 rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer h-full"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl" />
                  <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />

                  <div className="relative z-10 space-y-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                      <Shield className="w-8 h-8 text-white" />
                    </div>

                    <div>
                      <h3 className="text-xl font-bold text-slate-800 group-hover:text-purple-700 transition-colors duration-300 mb-2">
                        Faculty Access
                      </h3>
                      <p className="text-slate-600 group-hover:text-purple-600 transition-colors duration-300 text-sm leading-relaxed">
                        Secure faculty services including package delivery, room
                        access, and administrative assistance with PIN
                        authentication.
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs font-medium text-purple-600 bg-purple-100 px-3 py-1 rounded-full">
                        Secure Access
                      </span>
                      <ArrowRight className="w-5 h-5 text-purple-500 group-hover:translate-x-1 transition-transform duration-300" />
                    </div>
                  </div>

                  {/* Animated border */}
                  <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-purple-300/50 transition-colors duration-500" />
                </motion.div>
              </Link>

              {/* AI Perception Card */}
              <Link href="/perception">
                <motion.div
                  variants={item}
                  whileHover={{ scale: 1.05, y: -8 }}
                  whileTap={{ scale: 0.95 }}
                  className="group relative overflow-hidden bg-gradient-to-br from-green-50 to-teal-50 border border-green-200/50 rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer h-full"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl" />
                  <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-green-400/20 to-teal-400/20 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />

                  <div className="relative z-10 space-y-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                      <Camera className="w-8 h-8 text-white" />
                    </div>

                    <div>
                      <h3 className="text-xl font-bold text-slate-800 group-hover:text-green-700 transition-colors duration-300 mb-2">
                        AI Perception
                      </h3>
                      <p className="text-slate-600 group-hover:text-green-600 transition-colors duration-300 text-sm leading-relaxed">
                        Advanced computer vision for real-time object detection,
                        safety monitoring, and intelligent campus surveillance.
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs font-medium text-green-600 bg-green-100 px-3 py-1 rounded-full">
                        Smart Vision
                      </span>
                      <ArrowRight className="w-5 h-5 text-green-500 group-hover:translate-x-1 transition-transform duration-300" />
                    </div>
                  </div>

                  {/* Animated border */}
                  <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-green-300/50 transition-colors duration-500" />
                </motion.div>
              </Link>

              {/* Campus Overview Card */}
              <Link href="/overview">
                <motion.div
                  variants={item}
                  whileHover={{ scale: 1.05, y: -8 }}
                  whileTap={{ scale: 0.95 }}
                  className="group relative overflow-hidden bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200/50 rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer h-full"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl" />
                  <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-orange-400/20 to-red-400/20 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />

                  <div className="relative z-10 space-y-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                      <MapPin className="w-8 h-8 text-white" />
                    </div>

                    <div>
                      <h3 className="text-xl font-bold text-slate-800 group-hover:text-orange-700 transition-colors duration-300 mb-2">
                        Campus Overview
                      </h3>
                      <p className="text-slate-600 group-hover:text-orange-600 transition-colors duration-300 text-sm leading-relaxed">
                        Interactive campus map showing all buildings,
                        facilities, and services. Get a complete overview of the
                        entire campus layout.
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs font-medium text-orange-600 bg-orange-100 px-3 py-1 rounded-full">
                        Full Map
                      </span>
                      <ArrowRight className="w-5 h-5 text-orange-500 group-hover:translate-x-1 transition-transform duration-300" />
                    </div>
                  </div>

                  {/* Animated border */}
                  <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-orange-300/50 transition-colors duration-500" />
                </motion.div>
              </Link>
            </motion.div>

            {/* Campus Stats */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6"
            >
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">10+</div>
                <div className="text-sm text-slate-600">Buildings</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600 mb-2">
                  5000+
                </div>
                <div className="text-sm text-slate-600">Students</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 mb-2">
                  24/7
                </div>
                <div className="text-sm text-slate-600">AI Support</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600 mb-2">
                  100%
                </div>
                <div className="text-sm text-slate-600">Coverage</div>
              </div>
            </motion.div>
          </div>

          {/* BOTTOM HALF: CLEAR FEATURE OPTIONS */}
          <div className="bg-white/80 backdrop-blur-xl border-t border-white/20">
            <div className="max-w-7xl mx-auto px-4 py-12">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-center mb-12"
              >
                <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
                  Choose Your Service
                </h2>
                <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                  Select from our comprehensive range of campus services
                  designed to enhance your experience
                </p>
              </motion.div>

              <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
              >
                {/* Visitor Help Card */}
                <Link href="/visitor">
                  <motion.div
                    variants={item}
                    whileHover={{ scale: 1.05, y: -8 }}
                    whileTap={{ scale: 0.95 }}
                    className="group relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/50 rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer h-full"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl" />
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-400/20 to-indigo-400/20 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />

                    <div className="relative z-10 space-y-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                        <GraduationCap className="w-8 h-8 text-white" />
                      </div>

                      <div>
                        <h3 className="text-xl font-bold text-slate-800 group-hover:text-blue-700 transition-colors duration-300 mb-2">
                          Visitor Help
                        </h3>
                        <p className="text-slate-600 group-hover:text-blue-600 transition-colors duration-300 text-sm leading-relaxed">
                          Complete campus navigation with interactive maps,
                          location guides, and real-time assistance for visitors
                          and guests.
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <span className="text-xs font-medium text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                          Navigation
                        </span>
                        <ArrowRight className="w-5 h-5 text-blue-500 group-hover:translate-x-1 transition-transform duration-300" />
                      </div>
                    </div>

                    {/* Animated border */}
                    <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-blue-300/50 transition-colors duration-500" />
                  </motion.div>
                </Link>

                {/* Faculty Access Card */}
                <Link href="/faculty">
                  <motion.div
                    variants={item}
                    whileHover={{ scale: 1.05, y: -8 }}
                    whileTap={{ scale: 0.95 }}
                    className="group relative overflow-hidden bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200/50 rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer h-full"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl" />
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />

                    <div className="relative z-10 space-y-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                        <Shield className="w-8 h-8 text-white" />
                      </div>

                      <div>
                        <h3 className="text-xl font-bold text-slate-800 group-hover:text-purple-700 transition-colors duration-300 mb-2">
                          Faculty Access
                        </h3>
                        <p className="text-slate-600 group-hover:text-purple-600 transition-colors duration-300 text-sm leading-relaxed">
                          Secure faculty services including package delivery,
                          room access, and administrative assistance with PIN
                          authentication.
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <span className="text-xs font-medium text-purple-600 bg-purple-100 px-3 py-1 rounded-full">
                          Secure Access
                        </span>
                        <ArrowRight className="w-5 h-5 text-purple-500 group-hover:translate-x-1 transition-transform duration-300" />
                      </div>
                    </div>

                    {/* Animated border */}
                    <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-purple-300/50 transition-colors duration-500" />
                  </motion.div>
                </Link>

                {/* AI Perception Card */}
                <Link href="/perception">
                  <motion.div
                    variants={item}
                    whileHover={{ scale: 1.05, y: -8 }}
                    whileTap={{ scale: 0.95 }}
                    className="group relative overflow-hidden bg-gradient-to-br from-green-50 to-teal-50 border border-green-200/50 rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer h-full"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl" />
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-green-400/20 to-teal-400/20 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />

                    <div className="relative z-10 space-y-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                        <Camera className="w-8 h-8 text-white" />
                      </div>

                      <div>
                        <h3 className="text-xl font-bold text-slate-800 group-hover:text-green-700 transition-colors duration-300 mb-2">
                          AI Perception
                        </h3>
                        <p className="text-slate-600 group-hover:text-green-600 transition-colors duration-300 text-sm leading-relaxed">
                          Advanced computer vision for real-time object
                          detection, safety monitoring, and intelligent campus
                          surveillance.
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <span className="text-xs font-medium text-green-600 bg-green-100 px-3 py-1 rounded-full">
                          Smart Vision
                        </span>
                        <ArrowRight className="w-5 h-5 text-green-500 group-hover:translate-x-1 transition-transform duration-300" />
                      </div>
                    </div>

                    {/* Animated border */}
                    <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-green-300/50 transition-colors duration-500" />
                  </motion.div>
                </Link>

                {/* Campus Overview Card */}
                <Link href="/overview">
                  <motion.div
                    variants={item}
                    whileHover={{ scale: 1.05, y: -8 }}
                    whileTap={{ scale: 0.95 }}
                    className="group relative overflow-hidden bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200/50 rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer h-full"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl" />
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-orange-400/20 to-red-400/20 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />

                    <div className="relative z-10 space-y-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                        <MapPin className="w-8 h-8 text-white" />
                      </div>

                      <div>
                        <h3 className="text-xl font-bold text-slate-800 group-hover:text-orange-700 transition-colors duration-300 mb-2">
                          Campus Overview
                        </h3>
                        <p className="text-slate-600 group-hover:text-orange-600 transition-colors duration-300 text-sm leading-relaxed">
                          Interactive campus map showing all buildings,
                          facilities, and services. Get a complete overview of
                          the entire campus layout.
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <span className="text-xs font-medium text-orange-600 bg-orange-100 px-3 py-1 rounded-full">
                          Full Map
                        </span>
                        <ArrowRight className="w-5 h-5 text-orange-500 group-hover:translate-x-1 transition-transform duration-300" />
                      </div>
                    </div>

                    {/* Animated border */}
                    <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-orange-300/50 transition-colors duration-500" />
                  </motion.div>
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
