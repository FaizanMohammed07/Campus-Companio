import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Route, Clock, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { useVoiceController } from "@/context/VoiceController";
import { motion } from "framer-motion";

export default function DirectionsPage({ params }: { params: { id: string } }) {
  const { destination, directions, isSpeaking } = useVoiceController();

  // Location configuration
  const locationConfig: Record<
    string,
    {
      name: string;
      icon: string;
      color: string;
      distance: string;
      time: string;
    }
  > = {
    FEE: {
      name: "Fee Payment Counter",
      icon: "💰",
      color: "from-amber-500 to-orange-600",
      distance: "250m",
      time: "3 min",
    },
    ADMISSION: {
      name: "Admissions Office",
      icon: "📝",
      color: "from-blue-500 to-indigo-600",
      distance: "180m",
      time: "2 min",
    },
    ADMIN: {
      name: "Admin Block",
      icon: "🏢",
      color: "from-slate-500 to-slate-700",
      distance: "320m",
      time: "4 min",
    },
    LIBRARY: {
      name: "Central Library",
      icon: "📚",
      color: "from-purple-500 to-pink-600",
      distance: "450m",
      time: "5 min",
    },
    EXAM: {
      name: "Exam Cell",
      icon: "🧑‍💼",
      color: "from-red-500 to-rose-600",
      distance: "200m",
      time: "2.5 min",
    },
    CANTEEN: {
      name: "Canteen & Food Court",
      icon: "🍽",
      color: "from-green-500 to-emerald-600",
      distance: "300m",
      time: "3.5 min",
    },
  };

  const locId = destination || params.id;
  const config = locationConfig[locId] || {
    name: locId,
    icon: "📍",
    color: "from-primary to-primary",
    distance: "???",
    time: "???",
  };
  const dirList = directions || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div
          className={`absolute top-0 left-0 w-96 h-96 bg-gradient-to-r ${config.color} rounded-full mix-blend-screen blur-3xl opacity-20 animate-pulse`}
        />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-l from-blue-500 to-cyan-600 rounded-full mix-blend-screen blur-3xl opacity-20 animate-pulse" />
      </div>

      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative z-20 px-6 py-6 border-b border-white/10 backdrop-blur-lg bg-slate-900/50"
      >
        <div className="flex items-center justify-between">
          <Link href="/visitor">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-white/10 text-white"
            >
              <ArrowLeft className="w-6 h-6" />
            </Button>
          </Link>
          <div className="text-center flex-1">
            <h1 className="text-3xl font-bold flex items-center justify-center gap-3 mb-1">
              {config.icon} {config.name}
            </h1>
            <p className="text-sm text-gray-400">Smart Campus Navigation</p>
          </div>
          <div className="w-10" />
        </div>
      </motion.div>

      {/* Main Content */}
      <main className="relative z-10 p-6 max-w-2xl mx-auto">
        {/* Distance & Time Card */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className={`bg-gradient-to-r ${config.color} rounded-2xl p-8 mb-8 text-white shadow-2xl`}
        >
          <div className="grid grid-cols-2 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold mb-2">{config.distance}</div>
              <div className="text-sm opacity-90 flex items-center justify-center gap-1">
                <Route className="w-4 h-4" />
                Distance
              </div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">{config.time}</div>
              <div className="text-sm opacity-90 flex items-center justify-center gap-1">
                <Clock className="w-4 h-4" />
                Estimated Time
              </div>
            </div>
          </div>
        </motion.div>

        {/* Instructions List */}
        <div className="space-y-3 mb-8">
          <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5" />
            Step-by-Step Directions
          </h2>

          {dirList.length > 0 ? (
            dirList.map((dir, idx) => (
              <motion.div
                key={idx}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: idx * 0.1 }}
                className="relative"
              >
                {/* Connector line */}
                {idx < dirList.length - 1 && (
                  <div className="absolute left-6 top-16 w-0.5 h-8 bg-gradient-to-b from-cyan-500 to-transparent" />
                )}

                {/* Step card */}
                <div className="flex gap-4 items-start bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-lg border border-white/20 rounded-2xl p-4 hover:border-cyan-500/50 transition-all hover:shadow-lg hover:shadow-cyan-500/20">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-lg text-white shadow-lg">
                    {idx + 1}
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-white text-base font-medium leading-relaxed">
                      {dir}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 text-gray-400"
            >
              <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No directions available</p>
            </motion.div>
          )}
        </div>

        {/* Action Buttons */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-2 gap-4 sticky bottom-0 pb-6"
        >
          <Link href="/visitor" className="block">
            <Button
              size="lg"
              variant="outline"
              className="w-full rounded-xl h-14 border-white/20 text-white hover:bg-white/10 hover:border-white/40"
            >
              ← Back
            </Button>
          </Link>
          <Link href="/visitor" className="block">
            <Button
              size="lg"
              className="w-full rounded-xl h-14 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
            >
              New Location →
            </Button>
          </Link>
        </motion.div>
      </main>
    </div>
  );
}
