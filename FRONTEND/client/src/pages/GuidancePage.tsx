import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronUp, MapPin, Zap, Check } from "lucide-react";
import { Link } from "wouter";
import { useVoiceController } from "@/context/VoiceController";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function GuidancePage({ params }: { params: { id: string } }) {
  const { destination, directions } = useVoiceController();
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState(false);

  const locationConfig: Record<string, { name: string; icon: string; color: string }> = {
    FEE: { name: "Fee Payment Counter", icon: "💰", color: "from-amber-500 to-orange-600" },
    ADMISSION: { name: "Admissions Office", icon: "📝", color: "from-blue-500 to-indigo-600" },
    ADMIN: { name: "Admin Block", icon: "🏢", color: "from-slate-500 to-slate-700" },
    LIBRARY: { name: "Central Library", icon: "📚", color: "from-purple-500 to-pink-600" },
    EXAM: { name: "Exam Cell", icon: "🧑‍💼", color: "from-red-500 to-rose-600" },
    CANTEEN: { name: "Canteen & Food Court", icon: "🍽", color: "from-green-500 to-emerald-600" },
  };

  const locId = destination || params.id;
  const config = locationConfig[locId] || { name: locId, icon: "📍", color: "from-primary to-primary" };
  const dirList = directions || [];

  const isLastStep = currentStep === dirList.length - 1;
  const currentDirection = dirList[currentStep] || "";
  const progress = dirList.length > 0 ? ((currentStep + 1) / dirList.length) * 100 : 0;

  const handleNext = () => {
    if (isLastStep) {
      setCompleted(true);
    } else {
      setCurrentStep(Math.min(dirList.length - 1, currentStep + 1));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden relative">
      {/* Animated background elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className={`absolute top-0 right-0 w-96 h-96 bg-gradient-to-r ${config.color} rounded-full mix-blend-screen blur-3xl opacity-20 animate-pulse`} />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full mix-blend-screen blur-3xl opacity-20 animate-pulse" />
      </div>

      {/* Header */}
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative z-20 px-6 py-4 flex items-center gap-4 border-b border-white/10 backdrop-blur-xl bg-slate-900/50"
      >
        <Link href="/visitor">
          <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/10 text-white h-10 w-10">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-1">
            {config.icon} {config.name}
          </h1>
          <p className="text-xs text-cyan-300">AR Navigation Active</p>
        </div>
      </motion.div>

      {/* Main Content */}
      <main className="relative z-10 px-6 pt-8 pb-32 max-w-2xl mx-auto">
        {/* Progress Circle */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center mb-12"
        >
          <div className="relative w-32 h-32">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
              {/* Background circle */}
              <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
              {/* Progress circle */}
              <motion.circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke="url(#progressGradient)"
                strokeWidth="4"
                strokeLinecap="round"
                pathLength={100}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: progress }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
                strokeDasharray={100}
              />
              <defs>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
            </svg>
            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-4xl font-bold text-cyan-400">{currentStep + 1}</div>
              <div className="text-xs text-gray-400">of {dirList.length}</div>
            </div>
          </div>
        </motion.div>

        {/* Current Instruction */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.9 }}
            transition={{ duration: 0.4 }}
            className="mb-12"
          >
            {/* Direction Card */}
            <div className="relative mb-8">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 rounded-3xl opacity-30 blur-xl"
              />
              <div className="relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 rounded-3xl p-8">
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="text-6xl text-center mb-4 drop-shadow-lg"
                >
                  <ChevronUp className="w-16 h-16 mx-auto text-cyan-400" />
                </motion.div>
                <p className="text-xl font-bold text-center text-white leading-relaxed mb-2">
                  {currentDirection}
                </p>
                <div className="text-center text-sm text-cyan-300 font-semibold">
                  Step {currentStep + 1} of {dirList.length}
                </div>
              </div>
            </div>

            {/* Step Indicator Dots */}
            <div className="flex justify-center gap-3 mb-8">
              {dirList.map((_, idx) => (
                <motion.div
                  key={idx}
                  animate={{
                    scale: idx === currentStep ? 1.3 : 1,
                    opacity: idx <= currentStep ? 1 : 0.4,
                  }}
                  transition={{ duration: 0.3 }}
                  className={`h-3 rounded-full ${
                    idx < currentStep
                      ? "w-3 bg-gradient-to-r from-cyan-500 to-blue-500"
                      : idx === currentStep
                        ? "w-8 bg-gradient-to-r from-cyan-400 to-blue-400 shadow-lg shadow-cyan-500/50"
                        : "w-3 bg-white/20"
                  }`}
                />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Floating particles */}
        <div className="relative h-16 mb-8">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-cyan-400 rounded-full"
              animate={{
                y: [0, -100, 0],
                opacity: [0, 1, 0],
                x: Math.cos((i / 3) * Math.PI * 2) * 30,
              }}
              transition={{
                duration: 2,
                delay: i * 0.2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              style={{ left: "50%", translateX: "-50%" }}
            />
          ))}
        </div>

        {/* Action Buttons */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent"
        >
          <div className="max-w-2xl mx-auto grid grid-cols-2 gap-4">
            <Button
              size="lg"
              variant="outline"
              className="rounded-xl h-14 border-white/20 text-white hover:bg-white/10 hover:border-white/40 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
            >
              ← Back
            </Button>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                size="lg"
                className="w-full rounded-xl h-14 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 font-bold"
                onClick={handleNext}
              >
                {isLastStep ? "Arrive! 🎉" : "Next Step →"}
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </main>

      {/* Arrival Celebration */}
      <AnimatePresence>
        {completed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0, rotateZ: -180 }}
              animate={{ scale: 1, rotateZ: 0 }}
              exit={{ scale: 0, rotateZ: 180 }}
              transition={{ type: "spring", stiffness: 100, damping: 10 }}
              className="text-center"
            >
              {/* Celebration particles */}
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-3 h-3 bg-cyan-400 rounded-full"
                  initial={{
                    x: 0,
                    y: 0,
                    opacity: 1,
                  }}
                  animate={{
                    x: (Math.random() - 0.5) * 200,
                    y: (Math.random() - 0.5) * 200,
                    opacity: 0,
                  }}
                  transition={{
                    duration: 2,
                    ease: "easeOut",
                  }}
                />
              ))}

              {/* Main celebration card */}
              <motion.div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl p-12 shadow-2xl max-w-sm mx-auto">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                  className="text-8xl mb-6 drop-shadow-lg"
                >
                  🎉
                </motion.div>
                <h2 className="text-4xl font-bold text-white mb-3">You've Arrived!</h2>
                <p className="text-xl text-green-50 mb-8">
                  {config.name}
                </p>
                <p className="text-sm text-green-100 mb-8 font-semibold">
                  ✓ Guidance Complete • Navigation Successful
                </p>
                <Link href="/visitor" className="block">
                  <Button
                    size="lg"
                    className="w-full rounded-xl h-14 bg-white text-green-600 hover:bg-gray-100 font-bold"
                  >
                    New Destination
                  </Button>
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
