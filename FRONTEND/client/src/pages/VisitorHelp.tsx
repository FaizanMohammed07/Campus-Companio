import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { motion } from "framer-motion";
import { useVoiceController } from "@/context/VoiceController";

const LOCATIONS = [
  { id: "A_BLOCK", name: "A Block", icon: "🏫" },
  { id: "B_BLOCK", name: "B Block", icon: "🏫" },
  { id: "C_BLOCK", name: "C Block", icon: "🏫" },
  { id: "FEE", name: "Fee Payment", icon: "💰" },
  { id: "ADMISSION", name: "Admissions", icon: "📝" },
  { id: "ADMIN", name: "Admin Office", icon: "🏢" },
  { id: "LIBRARY", name: "Library", icon: "📚" },
  { id: "EXAM", name: "Exam Cell", icon: "🧑‍💼" },
  { id: "CANTEEN", name: "Canteen", icon: "🍽" },
];

const DIRECTIONS_DB: Record<string, string[]> = {
  A_BLOCK: [
    "Go to the main academic corridor.",
    "Follow the campus signboards for A Block.",
    "At the junction, take the route marked A Block.",
  ],
  B_BLOCK: [
    "Go to the main academic corridor.",
    "Follow the campus signboards for B Block.",
    "At the junction, take the route marked B Block.",
  ],
  C_BLOCK: [
    "Go to the main academic corridor.",
    "Follow the campus signboards for C Block.",
    "C Block is at the end of the corridor on the right.",
  ],
  ADMIN: [
    "Go to the Admin Block front office area.",
    "Look for the Admin office signage.",
    "Ask the reception desk if you need further assistance.",
  ],
  ADMISSION: [
    "Go to the Admin Block front office area.",
    "Look for the Admissions counter signage.",
    "Ask the reception desk if you need further assistance.",
  ],
  FEE: [
    "Go to the Admin Block accounts area.",
    "Look for the Fee Payment or Accounts counter.",
    "Ask the reception desk if needed.",
  ],
  LIBRARY: [
    "Go to the main academic corridor.",
    "Follow signs for the Library in C Block.",
    "The library is on the second floor.",
  ],
  CANTEEN: [
    "Go to the D Block area.",
    "Look for the Canteen entrance.",
    "The canteen is open from 8 AM to 8 PM.",
  ],
  EXAM: [
    "Go to the Admin Block.",
    "Look for the Exam Cell office.",
    "Ask the staff for exam schedules and details.",
  ],
};

export default function VisitorHelp() {
  const [selectedLoc, setSelectedLoc] = useState<(typeof LOCATIONS)[0] | null>(
    null,
  );
  const { setDestination, setDirections, dispatch } = useVoiceController();
  const [, setLocation] = useLocation();

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
          <h1 className="text-2xl font-bold">Where can I help you?</h1>
          <p className="text-muted-foreground">Select a destination or speak</p>
        </div>
      </div>

      {/* Location grid */}
      <div className="grid grid-cols-3 gap-3 flex-1 content-start mb-6">
        {LOCATIONS.map((loc) => (
          <motion.button
            key={loc.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedLoc(loc)}
            className="flex flex-col items-center justify-center p-6 bg-white border border-border rounded-2xl shadow-sm hover:shadow-md hover:border-primary/50 transition-all aspect-square gap-3 text-center"
          >
            <span className="text-4xl">{loc.icon}</span>
            <span className="font-semibold text-sm text-foreground">
              {loc.name}
            </span>
          </motion.button>
        ))}
      </div>

      {/* Confirmation dialog */}
      <Dialog
        open={!!selectedLoc}
        onOpenChange={(open) => !open && setSelectedLoc(null)}
      >
        <DialogContent className="rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-2xl text-center pt-4">
              {selectedLoc?.icon} {selectedLoc?.name}
            </DialogTitle>
            <DialogDescription className="text-center text-base pt-3">
              Get directions or let me guide you there.
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 flex gap-3">
            <Button
              size="lg"
              className="flex-1 rounded-xl h-12"
              onClick={() => {
                if (selectedLoc) {
                  const dirList = DIRECTIONS_DB[selectedLoc.id] || [];
                  setDestination(selectedLoc.id);
                  setDirections(dirList);
                  void dispatch("navigation", { transcript: selectedLoc.name });
                  setLocation(`/directions/${selectedLoc.id}`);
                  setSelectedLoc(null);
                }
              }}
            >
              Show Directions
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="flex-1 rounded-xl h-12"
              onClick={async () => {
                if (selectedLoc) {
                  const dirList = DIRECTIONS_DB[selectedLoc.id] || [];
                  setDestination(selectedLoc.id);
                  setDirections(dirList);

                  // Start the real robot mission via backend → vision server
                  try {
                    const res = await fetch("/api/mission", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ destination: selectedLoc.id }),
                    });
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({}));
                      console.error("[GuideMe] Mission start failed:", err);
                    }
                  } catch (e) {
                    console.error("[GuideMe] Network error starting mission:", e);
                  }

                  void dispatch("guide", { destination: selectedLoc.id });
                  setLocation(`/guidance/${selectedLoc.id}`);
                  setSelectedLoc(null);
                }
              }}
            >
              Guide Me
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
