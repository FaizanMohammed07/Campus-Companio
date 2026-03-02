import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, CheckCircle2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useVoiceController } from "@/context/VoiceController";
import { motion } from "framer-motion";

export default function DirectionsPage({ params }: { params: { id: string } }) {
  const { destination, directions } = useVoiceController();
  const [, navigate] = useLocation();

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

  return (
    <div className="min-h-screen p-6 max-w-lg mx-auto flex flex-col">
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
          <p className="text-muted-foreground">Directions</p>
        </div>
      </div>

      {/* Directions List */}
      <div className="flex-1 space-y-4 mb-6">
        {dirList.length > 0 ? (
          dirList.map((dir, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="flex gap-4 items-start p-4 bg-white rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                {idx + 1}
              </div>
              <p className="flex-1 text-base text-foreground pt-1">{dir}</p>
            </motion.div>
          ))
        ) : (
          <div className="text-center text-muted-foreground py-8">
            <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No directions available</p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/visitor">
          <Button
            size="lg"
            variant="outline"
            className="w-full rounded-xl h-12"
          >
            Back
          </Button>
        </Link>
        <Link href="/visitor">
          <Button size="lg" className="w-full rounded-xl h-12">
            New Destination
          </Button>
        </Link>
      </div>
    </div>
  );
}
