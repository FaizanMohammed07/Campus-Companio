import { RobotFace } from "@/components/RobotFace";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GraduationCap, Package, Info } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";

export default function Home() {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 space-y-8 max-w-lg mx-auto">
      {/* Robot Face & Greeting */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-6 w-full"
      >
        <RobotFace className="mb-8" />
        
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-foreground tracking-tight">
            Hello! <span className="inline-block animate-wave">👋</span>
          </h1>
          <p className="text-xl text-muted-foreground font-medium">
            I’m your Campus Guide.
            <br />
            How can I help you today?
          </p>
        </div>
      </motion.div>

      {/* Main Actions */}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 w-full gap-4 pt-4"
      >
        <motion.div variants={item}>
          <Link href="/visitor">
            <Button 
              size="lg" 
              className="w-full h-24 text-xl rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all bg-white text-primary border-2 border-primary/10 hover:border-primary/30 flex items-center justify-start px-8 gap-6 group"
              data-testid="button-visitor"
            >
              <div className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors">
                <GraduationCap className="w-8 h-8 text-primary" />
              </div>
              <div className="text-left">
                <span className="block font-bold text-foreground">Visitor Help</span>
                <span className="text-sm text-muted-foreground font-normal">Find locations & info</span>
              </div>
            </Button>
          </Link>
        </motion.div>

        <motion.div variants={item}>
          <Link href="/faculty">
            <Button 
              size="lg" 
              className="w-full h-24 text-xl rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all bg-white text-primary border-2 border-primary/10 hover:border-primary/30 flex items-center justify-start px-8 gap-6 group"
              data-testid="button-faculty"
            >
               <div className="p-3 bg-purple-100 rounded-xl group-hover:bg-purple-200 transition-colors">
                <Package className="w-8 h-8 text-purple-600" />
              </div>
              <div className="text-left">
                <span className="block font-bold text-foreground">Faculty & Office</span>
                <span className="text-sm text-muted-foreground font-normal">Deliveries & Tasks</span>
              </div>
            </Button>
          </Link>
        </motion.div>

        <motion.div variants={item}>
          <Button 
            size="lg" 
            variant="ghost"
            className="w-full h-16 text-lg rounded-xl text-muted-foreground hover:bg-muted/50"
            data-testid="button-info"
          >
            <Info className="w-5 h-5 mr-2" />
            Campus Information
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
