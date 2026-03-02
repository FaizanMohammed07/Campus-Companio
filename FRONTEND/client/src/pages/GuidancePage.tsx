import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight, MapPin } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useVoiceController } from "@/context/VoiceController";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";

export default function GuidancePage({ params }: { params: { id: string } }) {
  const { destination, directions, isSpeaking } = useVoiceController();
  const [, navigate] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);

  // Get the location name from ID
  const locationNames: Record<string, string> = {
    FEE: "Fee Payment",
    ADMISSION: "Admissions",
    ADMIN: "Admin Office",
    LIBRARY: "Library",
    EXAM: "Exam Cell",
    CANTEEN: "Canteen",
  };

  const locationIcons: Record<string, string> = {
    FEE: "💰",
    ADMISSION: "📝",
    ADMIN: "🏢",
    LIBRARY: "📚",
    EXAM: "🧑‍💼",
    CANTEEN: "🍽",
  };

  const locId = destination || params.id;
  const locName = locationNames[locId] || locId;
  const locIcon = locationIcons[locId] || "📍";
  const dirList = directions || [];

  const isLastStep = currentStep === dirList.length - 1;
  const currentDirection = dirList[currentStep] || "";

  // Handle completing guidance
  const handleComplete = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen p-6 max-w-lg mx-auto flex flex-col bg-gradient-to-b from-background via-background to-primary/5">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/visitor">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-12 w-12 hover:bg-muted"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {locIcon} {locName}
          </h1>
          <p className="text-muted-foreground">Step-by-Step Guidance</p>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-foreground">
            Step {currentStep + 1} of {dirList.length}
          </span>
          <span className="text-sm text-muted-foreground">
            {Math.round(((currentStep + 1) / dirList.length) * 100)}%
          </span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: "0%" }}
            animate={{
              width: `${((currentStep + 1) / dirList.length) * 100}%`,
            }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          />
        </div>
      </div>

      {/* Current Direction */}
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="flex-1 flex flex-col items-center justify-center mb-8"
      >
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <MapPin className="w-10 h-10 text-primary" />
        </div>
        <div className="text-center px-4 py-8 bg-white rounded-2xl shadow-sm border border-border">
          <p className="text-lg font-medium text-foreground leading-relaxed">
            {currentDirection}
          </p>
        </div>
      </motion.div>

      {/* Step Counter */}
      <div className="flex gap-2 justify-center mb-8">
        {dirList.map((_, idx) => (
          <div
            key={idx}
            className={`h-2 rounded-full transition-all ${
              idx === currentStep
                ? "w-6 bg-primary"
                : idx < currentStep
                  ? "w-3 bg-primary/40"
                  : "w-3 bg-muted"
            }`}
          />
        ))}
      </div>

      {/* Navigation Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          size="lg"
          variant="outline"
          className="w-full rounded-xl h-12"
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
        >
          ← Previous
        </Button>
        <Button
          size="lg"
          className="w-full rounded-xl h-12"
          onClick={() => {
            if (isLastStep) {
              handleComplete();
            } else {
              setCurrentStep(Math.min(dirList.length - 1, currentStep + 1));
            }
          }}
        >
          {isLastStep ? "Arrived! 🎉" : "Next →"}
        </Button>
      </div>

      {/* Info Text */}
      {isLastStep && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center text-green-600 font-semibold text-sm mt-4"
        >
          ✓ You&apos;ve reached your destination!
        </motion.p>
      )}
    </div>
  );
}
