import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Trash2, Play, Users, Calendar, MapPin } from "lucide-react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

// ── Types ──

interface Guest {
  id: string;
  name: string;
  title: string;
  description: string;
  order: number;
  announced: boolean;
  script: string | null;
}

interface EventData {
  name: string;
  venue: string;
  date: string;
  description: string;
  active: boolean;
}

// ── Component ──

export default function EventSetup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Event form state
  const [eventName, setEventName] = useState("");
  const [venue, setVenue] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventCreated, setEventCreated] = useState(false);

  // Guest form state
  const [guestName, setGuestName] = useState("");
  const [guestTitle, setGuestTitle] = useState("");
  const [guestDescription, setGuestDescription] = useState("");

  // Runsheet
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Load existing runsheet on mount ──
  const loadRunsheet = useCallback(async () => {
    try {
      const res = await fetch("/api/host/runsheet");
      const json = await res.json();
      if (json.ok && json.data?.event) {
        setGuests(json.data.guests || []);
        setEventCreated(true);
        setEventName(json.data.event.name);
        setVenue(json.data.event.venue);
        setEventDate(json.data.event.date);
        setEventDescription(json.data.event.description || "");
      }
    } catch (e) {
      console.error("[EventSetup] Failed to load runsheet:", e);
    }
  }, []);

  useEffect(() => {
    loadRunsheet();
  }, [loadRunsheet]);

  // ── Create / update event ──
  const handleCreateEvent = async () => {
    if (!eventName.trim() || !venue.trim() || !eventDate.trim()) {
      toast({
        title: "Missing fields",
        description: "Please fill in event name, venue, and date.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/host/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: eventName.trim(),
          venue: venue.trim(),
          date: eventDate.trim(),
          description: eventDescription.trim(),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setEventCreated(true);
        toast({
          title: "Event created! 🎉",
          description: json.data.message,
        });
      } else {
        toast({
          title: "Error",
          description: json.error?.message || "Failed to create event",
          variant: "destructive",
        });
      }
    } catch (e) {
      console.error("[EventSetup] Create event error:", e);
      toast({
        title: "Network error",
        description: "Could not reach the server.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ── Add guest ──
  const handleAddGuest = async () => {
    if (!guestName.trim() || !guestTitle.trim()) {
      toast({
        title: "Missing fields",
        description: "Please provide guest name and title.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/host/guests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: guestName.trim(),
          title: guestTitle.trim(),
          description: guestDescription.trim(),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setGuestName("");
        setGuestTitle("");
        setGuestDescription("");
        await loadRunsheet();
        toast({
          title: "Guest added! 👤",
          description: `${json.data.guest.name} added to runsheet`,
        });
      } else {
        toast({
          title: "Error",
          description: json.error?.message || "Failed to add guest",
          variant: "destructive",
        });
      }
    } catch (e) {
      console.error("[EventSetup] Add guest error:", e);
      toast({
        title: "Network error",
        description: "Could not reach the server.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ── Remove guest ──
  const handleRemoveGuest = async (id: string) => {
    try {
      const res = await fetch(`/api/host/guests/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        await loadRunsheet();
        toast({ title: "Guest removed" });
      }
    } catch (e) {
      console.error("[EventSetup] Remove guest error:", e);
    }
  };

  // ── Start host mode ──
  const handleStartHostMode = () => {
    if (guests.length === 0) {
      toast({
        title: "No guests",
        description: "Add at least one guest to start hosting.",
        variant: "destructive",
      });
      return;
    }
    setLocation("/host-mode");
  };

  // ── Animation variants ──
  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 },
  };

  return (
    <div className="min-h-screen p-6 max-w-lg mx-auto flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
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
          <h1 className="text-2xl font-bold">🎤 Event Setup</h1>
          <p className="text-muted-foreground text-sm">
            Configure your event and guest list
          </p>
        </div>
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-6 flex-1"
      >
        {/* ── Event Details Form ── */}
        <motion.div
          variants={item}
          className="bg-white/80 backdrop-blur-md border border-white/40 rounded-2xl p-5 shadow-lg space-y-4"
        >
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Event Details
          </h2>

          <Input
            placeholder="Event name *"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            className="rounded-xl h-12"
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <MapPin className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Venue *"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                className="rounded-xl h-12 pl-9"
              />
            </div>
            <Input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="rounded-xl h-12"
            />
          </div>
          <Input
            placeholder="Description (optional)"
            value={eventDescription}
            onChange={(e) => setEventDescription(e.target.value)}
            className="rounded-xl h-12"
          />
          <Button
            onClick={handleCreateEvent}
            disabled={loading}
            className="w-full rounded-xl h-12 font-bold"
          >
            {eventCreated ? "Update Event" : "Create Event"}
          </Button>
        </motion.div>

        {/* ── Add Guest Form (only if event created) ── */}
        <AnimatePresence>
          {eventCreated && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-white/80 backdrop-blur-md border border-white/40 rounded-2xl p-5 shadow-lg space-y-4 overflow-hidden"
            >
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Add Guest
              </h2>

              <Input
                placeholder="Guest name *"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="rounded-xl h-12"
              />
              <Input
                placeholder="Title / Role *"
                value={guestTitle}
                onChange={(e) => setGuestTitle(e.target.value)}
                className="rounded-xl h-12"
              />
              <Input
                placeholder="About the guest (optional)"
                value={guestDescription}
                onChange={(e) => setGuestDescription(e.target.value)}
                className="rounded-xl h-12"
              />
              <Button
                onClick={handleAddGuest}
                disabled={loading}
                variant="secondary"
                className="w-full rounded-xl h-12 font-bold"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add to Runsheet
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Guest Runsheet ── */}
        <AnimatePresence>
          {guests.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white/80 backdrop-blur-md border border-white/40 rounded-2xl p-5 shadow-lg space-y-3"
            >
              <h2 className="text-lg font-bold">
                📋 Runsheet ({guests.length} guest{guests.length !== 1 ? "s" : ""})
              </h2>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {guests.map((guest, idx) => (
                  <motion.div
                    key={guest.id}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 20, opacity: 0 }}
                    className="flex items-center gap-3 p-3 bg-white/60 rounded-xl border border-border/50"
                  >
                    <span className="text-sm font-bold text-muted-foreground w-6 text-center">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {guest.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {guest.title}
                      </p>
                    </div>
                    {guest.announced && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        ✓
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleRemoveGuest(guest.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Start Host Mode Button ── */}
        <AnimatePresence>
          {eventCreated && guests.length > 0 && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
            >
              <Button
                onClick={handleStartHostMode}
                className="w-full h-16 rounded-2xl text-xl font-bold bg-gradient-to-r from-violet-600 to-fuchsia-500 hover:from-violet-700 hover:to-fuchsia-600 shadow-xl"
              >
                <Play className="w-6 h-6 mr-3" />
                Start Host Mode
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
