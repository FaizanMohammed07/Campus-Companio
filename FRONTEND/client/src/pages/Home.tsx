import { RobotFace } from "@/components/RobotFace";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GraduationCap, Package, Info, Mic2 } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";

export default function Home() {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 },
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 space-y-8 max-w-lg mx-auto">
      {/* Robot Face & Greeting */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-6 w-full relative z-10"
      >
        <div className="relative inline-block animate-float">
          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 -z-10" />
          <RobotFace className="mb-8 drop-shadow-2xl" />
        </div>

        <div className="space-y-2">
          <h1 className="text-5xl font-display font-bold text-foreground tracking-tight drop-shadow-sm">
            Hello, Human <span className="inline-block animate-wave">👋</span>
          </h1>
          <p className="text-xl text-muted-foreground font-medium max-w-xs mx-auto leading-relaxed">
            I am your{" "}
            <span className="text-primary font-bold">Campus Companion</span>.
            <br />
            Ready to assist.
          </p>
        </div>
      </motion.div>

      {/* Main Actions */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 w-full gap-5 pt-6 max-w-sm"
      >
        <motion.div variants={item}>
          <Link href="/visitor">
            <Button
              size="lg"
              className="w-full h-24 text-xl rounded-[2rem] shadow-xl hover:shadow-2xl bg-white/80 backdrop-blur-md text-foreground border border-white/40 flex items-center justify-start px-8 gap-6 group hover-card-effect relative overflow-hidden"
              data-testid="button-visitor"
            >
              <div className="p-4 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-300 ring-2 ring-white/50">
                <Info className="w-8 h-8 text-white" />
              </div>
              <div className="text-left z-10">
                <span className="block font-bold text-xl tracking-wide">
                  Visitor Help
                </span>
                <span className="text-sm text-slate-500 font-medium opacity-80">
                  Find locations & info
                </span>
              </div>
            </Button>
          </Link>
        </motion.div>

        <motion.div variants={item}>
          <Link href="/faculty">
            <Button
              size="lg"
              className="w-full h-24 text-xl rounded-[2rem] shadow-xl hover:shadow-2xl bg-white/80 backdrop-blur-md text-foreground border border-white/40 flex items-center justify-start px-8 gap-6 group hover-card-effect relative overflow-hidden"
              data-testid="button-faculty"
            >
              <div className="p-4 bg-gradient-to-br from-violet-600 to-fuchsia-500 rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-300 ring-2 ring-white/50">
                <GraduationCap className="w-8 h-8 text-white" />
              </div>
              <div className="text-left z-10">
                <span className="block font-bold text-xl tracking-wide">
                  Faculty Access
                </span>
                <span className="text-sm text-slate-500 font-medium opacity-80">
                  Deliveries & Tasks
                </span>
              </div>
            </Button>
          </Link>
        </motion.div>

        <motion.div variants={item}>
          <Link href="/event-setup">
            <Button
              size="lg"
              className="w-full h-24 text-xl rounded-[2rem] shadow-xl hover:shadow-2xl bg-white/80 backdrop-blur-md text-foreground border border-white/40 flex items-center justify-start px-8 gap-6 group hover-card-effect relative overflow-hidden"
              data-testid="button-host"
            >
              <div className="p-4 bg-gradient-to-br from-amber-500 to-rose-500 rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-300 ring-2 ring-white/50">
                <Mic2 className="w-8 h-8 text-white" />
              </div>
              <div className="text-left z-10">
                <span className="block font-bold text-xl tracking-wide">
                  Host Mode
                </span>
                <span className="text-sm text-slate-500 font-medium opacity-80">
                  Event hosting & announcements
                </span>
              </div>
            </Button>
          </Link>
        </motion.div>

        <motion.div variants={item} className="pt-4">
          <Link href="/perception">
            <Button
              size="lg"
              variant="ghost"
              className="w-full rounded-full text-slate-400 hover:text-primary hover:bg-primary/5 transition-all text-sm font-medium tracking-widest uppercase"
              data-testid="button-perception"
            >
              <Package className="w-4 h-4 mr-2" />
              Initialize System Perception
            </Button>
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
