import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, MapPin, Check, Footprints } from "lucide-react";
import { Link } from "wouter";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { VoiceStatus } from "@/components/VoiceStatus";
import { useVoiceController } from "@/context/VoiceController";
import { speakAsync } from "@/hooks/use-speech";

const LOCATIONS = [
  { id: "fee", name: "Fee Payment", icon: "💰", block: "A Block" },
  { id: "admissions", name: "Admissions", icon: "📝", block: "Admin Block" },
  { id: "admin", name: "Admin Office", icon: "🏢", block: "Admin Block" },
  { id: "library", name: "Library", icon: "📚", block: "C Block" },
  { id: "exam", name: "Exam Cell", icon: "🧑‍💼", block: "B Block" },
  { id: "canteen", name: "Canteen", icon: "🍽", block: "D Block" },
  { id: "other", name: "Other", icon: "📍", block: "Various" },
];

export default function VisitorHelp() {
  // Fix: Add missing handleSelect function
  const handleSelect = (loc: (typeof LOCATIONS)[0]) => {
    setSelectedLoc(loc);
  };
  const [selectedLoc, setSelectedLoc] = useState<(typeof LOCATIONS)[0] | null>(
    null,
  );
  const [isGuiding, setIsGuiding] = useState(false);
  const [showDirectionsPanel, setShowDirectionsPanel] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [steps, setSteps] = useState<string[]>([]);
  const [spokenDirections, setSpokenDirections] = useState("");
  const [guidingLoc, setGuidingLoc] = useState<(typeof LOCATIONS)[0] | null>(
    null,
  );
  const { currentTask, destination, guidanceMode, directions, dispatch } =
    useVoiceController();

  // Helper to get directions for a location
  function getDirectionsForLoc(loc: (typeof LOCATIONS)[0]) {
    switch (loc.id) {
      case "fee":
        return [
          "Go to the main academic corridor.",
          "Follow the campus signboards for A Block.",
          "At the junction, take the route marked A Block and continue straight.",
          "Look for the Fee Payment / Accounts counter.",
          "If needed, ask the reception desk for Fee Payment.",
        ];
      case "admissions":
        return [
          "Go to the Admin Block / Front Office area.",
          "Look for the Admissions counter signage.",
          "If needed, ask the reception desk for Admissions.",
        ];
      case "admin":
        return [
          "Go to the Admin Block.",
          "Look for the Admin Office signage.",
          "If needed, ask the reception desk for Admin Office.",
        ];
      case "library":
        return [
          "Go to the main academic corridor.",
          "Follow the campus signboards for C Block.",
          "At the junction, take the route marked C Block and continue straight.",
          "Look for the Library signage.",
        ];
      case "exam":
        return [
          "Go to the main academic corridor.",
          "Follow the campus signboards for B Block.",
          "At the junction, take the route marked B Block and continue straight.",
          "Look for the Exam Cell signage.",
        ];
      case "canteen":
        return [
          "Go to the D Block area.",
          "Look for the Canteen signage.",
          "Enjoy your meal!",
        ];
      default:
        return ["Please ask a staff member for directions."];
    }
  }

  // When "No, just show directions" is clicked
  const handleShowDirections = async () => {
    if (!selectedLoc) return;
    const dirSteps = getDirectionsForLoc(selectedLoc);
    setSteps(dirSteps);
    setSpokenDirections(dirSteps.join(". "));
    setShowDirectionsPanel(true);
    setSelectedLoc(null);
    await speakAsync(
      `Here are the directions to ${selectedLoc.name}. ${dirSteps.join(". ")}`,
    );
  };

  // When "Yes, guide me" is clicked
  const handleStartGuide = async () => {
    if (!selectedLoc) return;
    setGuidingLoc(selectedLoc);
    setIsGuiding(true);
    setStepIdx(0);
    setSteps(getDirectionsForLoc(selectedLoc));
    setSelectedLoc(null);
    await speakAsync(
      `Please follow me to ${selectedLoc.name}. ${getDirectionsForLoc(selectedLoc)[0]}`,
    );
  };

  // Step-by-step guidance: speak each step
  const handleNextStep = async () => {
    if (stepIdx + 1 < steps.length) {
      setStepIdx(stepIdx + 1);
      await speakAsync(steps[stepIdx + 1]);
    } else {
      await speakAsync(`You have reached ${guidingLoc?.name}.`);
      setIsGuiding(false);
      setGuidingLoc(null);
      setStepIdx(0);
      setSteps([]);
    }
  };

  // Cancel guidance
  const handleCancelGuide = () => {
    setIsGuiding(false);
    setGuidingLoc(null);
    setStepIdx(0);
    setSteps([]);
  };

  // UI helpers
  const destinationLabel =
    guidingLoc?.name || selectedLoc?.name || "Destination";

  if (isGuiding && guidingLoc) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-primary text-primary-foreground relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent scale-150 animate-pulse" />
        </div>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-8 relative z-10"
        >
          <div className="w-32 h-32 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
            <Footprints className="w-16 h-16 text-white" />
          </div>
          <h1 className="text-4xl font-bold">Guiding to {guidingLoc.name}</h1>
          <p className="text-xl opacity-90">{steps[stepIdx]}</p>
          <div className="max-w-xs mx-auto bg-white/10 rounded-full h-2 mt-8 overflow-hidden">
            <motion.div
              className="h-full bg-white"
              initial={{ width: `${(stepIdx / steps.length) * 100}%` }}
              animate={{ width: `${((stepIdx + 1) / steps.length) * 100}%` }}
              transition={{ duration: 1, ease: "linear" }}
            />
          </div>
        </motion.div>
        <div className="flex gap-4 mt-8">
          <Button
            variant="secondary"
            className="rounded-full px-8 py-4 text-lg shadow-lg"
            onClick={handleCancelGuide}
          >
            Cancel
          </Button>
          <Button
            className="rounded-full px-8 py-4 text-lg shadow-lg"
            onClick={handleNextStep}
            disabled={stepIdx >= steps.length - 1}
          >
            {stepIdx < steps.length - 1 ? "Next" : "Finish"}
          </Button>
        </div>
        <VoiceStatus state="speaking" text={steps[stepIdx]} />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 max-w-lg mx-auto flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-12 w-12 hover:bg-muted"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Where can I take you?</h1>
          <p className="text-muted-foreground">Select a destination</p>
        </div>
      </div>

      {/* Directions panel (for "Just show me directions") */}
      {showDirectionsPanel && (
        <Card className="rounded-2xl p-4 mb-6 border-primary/20 bg-primary/5">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-foreground">
              Directions to {destinationLabel}
            </h2>
          </div>
          <ol className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground">
            {steps.map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
          </ol>
          <div className="flex gap-3 mt-4">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setShowDirectionsPanel(false)}
            >
              Close
            </Button>
          </div>
        </Card>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 gap-4 flex-1 content-start">
        {LOCATIONS.map((loc) => (
          <motion.button
            key={loc.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleSelect(loc)}
            className="flex flex-col items-center justify-center p-6 bg-white border border-border rounded-2xl shadow-sm hover:shadow-md hover:border-primary/50 transition-all aspect-square gap-3 text-center"
            data-testid={`btn-loc-${loc.id}`}
          >
            <span className="text-4xl filter drop-shadow-sm">{loc.icon}</span>
            <span className="font-semibold text-foreground">{loc.name}</span>
          </motion.button>
        ))}
      </div>

      {/* Confirmation Dialog */}
      <Dialog
        open={!!selectedLoc}
        onOpenChange={(open) => !open && setSelectedLoc(null)}
      >
        <DialogContent className="rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-2xl text-center pt-4">
              {selectedLoc?.icon} {selectedLoc?.name}
            </DialogTitle>
            <DialogDescription className="text-center text-lg pt-2">
              This is located in{" "}
              <span className="font-bold text-primary">
                {selectedLoc?.block}
              </span>
              .
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 text-center text-muted-foreground">
            Would you like me to guide you there?
          </div>
          <div className="flex flex-col gap-3 pb-2">
            <Button
              size="lg"
              className="w-full rounded-xl h-14 text-lg gap-2"
              onClick={handleStartGuide}
            >
              <Check className="w-5 h-5" /> Yes, guide me
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full rounded-xl h-14 text-lg"
              onClick={handleShowDirections}
            >
              No, just show directions
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <VoiceStatus state="idle" text="Select a destination." />
    </div>
  );
}
