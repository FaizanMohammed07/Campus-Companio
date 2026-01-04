import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Truck, Bell, Navigation, MapPin, Send } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { motion } from "framer-motion";
import { VoiceStatus } from "@/components/VoiceStatus";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";

type ViewState = "auth" | "menu" | "delivery" | "status";

export default function FacultyAccess() {
  const [view, setView] = useState<ViewState>("auth");
  const [pin, setPin] = useState("");
  const [deliveryType, setDeliveryType] = useState<"pickup" | "dropoff">("pickup");
  const [statusMessage, setStatusMessage] = useState("");

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length === 4) {
      setView("menu");
    }
  };

  const startDelivery = () => {
    setView("status");
    setStatusMessage("Robot is on the way to your location.");
  };

  return (
    <div className="min-h-screen p-6 max-w-lg mx-auto flex flex-col">
      {/* Header */}
      {view !== "status" && (
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full h-12 w-12 hover:bg-muted"
            onClick={() => view === "menu" ? setView("auth") : view === "delivery" ? setView("menu") : window.history.back()}
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Faculty Mode</h1>
            {view === "menu" && <p className="text-sm text-muted-foreground">Dr. Smith • Admin Block</p>}
          </div>
        </div>
      )}

      {/* Auth Screen */}
      {view === "auth" && (
        <div className="flex flex-col items-center justify-center flex-1 space-y-8">
          <div className="text-center space-y-2">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">Enter Access PIN</h2>
            <p className="text-muted-foreground">Please identify yourself</p>
          </div>

          <form onSubmit={handlePinSubmit} className="w-full max-w-xs space-y-4">
            <div className="flex justify-center gap-2">
                <Input 
                    type="password" 
                    maxLength={4}
                    className="text-center text-4xl tracking-widest h-16 rounded-2xl border-2 focus:border-primary font-mono"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="••••"
                    autoFocus
                />
            </div>
            <Button size="lg" className="w-full rounded-xl h-14 text-lg mt-4" disabled={pin.length < 4}>
              Verify Access
            </Button>
          </form>
        </div>
      )}

      {/* Menu Screen */}
      {view === "menu" && (
        <div className="grid grid-cols-1 gap-4 pt-4 animate-in fade-in slide-in-from-bottom-4">
           <Button 
            variant="outline"
            className="h-32 rounded-3xl flex flex-col items-center justify-center gap-3 border-2 hover:border-primary/50 hover:bg-primary/5 transition-all group"
            onClick={() => {
                setStatusMessage("Robot coming to your location.");
                setView("status");
            }}
           >
             <div className="p-4 bg-blue-100 rounded-full group-hover:bg-blue-200 transition-colors">
                 <Navigation className="w-8 h-8 text-blue-600" />
             </div>
             <div className="text-center">
                 <span className="block text-lg font-bold">Call to Me</span>
                 <span className="text-muted-foreground font-normal">I'm at Admin Block</span>
             </div>
           </Button>

           <Button 
            variant="outline"
            className="h-32 rounded-3xl flex flex-col items-center justify-center gap-3 border-2 hover:border-primary/50 hover:bg-primary/5 transition-all group"
            onClick={() => setView("delivery")}
           >
             <div className="p-4 bg-orange-100 rounded-full group-hover:bg-orange-200 transition-colors">
                 <Truck className="w-8 h-8 text-orange-600" />
             </div>
             <div className="text-center">
                 <span className="block text-lg font-bold">Send Item</span>
                 <span className="text-muted-foreground font-normal">Deliver document/package</span>
             </div>
           </Button>
        </div>
      )}

      {/* Delivery Screen */}
      {view === "delivery" && (
        <div className="space-y-6 animate-in slide-in-from-right-8">
            <Card className="p-6 rounded-3xl space-y-6">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Select Destination Block</label>
                    <Select>
                        <SelectTrigger className="h-14 rounded-xl text-lg">
                            <SelectValue placeholder="Choose location" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="a">A Block</SelectItem>
                            <SelectItem value="b">B Block</SelectItem>
                            <SelectItem value="library">Library</SelectItem>
                            <SelectItem value="exam">Exam Cell</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Item Type</label>
                    <Select>
                        <SelectTrigger className="h-14 rounded-xl text-lg">
                            <SelectValue placeholder="What are you sending?" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="docs">Documents</SelectItem>
                            <SelectItem value="package">Box / Package</SelectItem>
                            <SelectItem value="equipment">Lab Equipment</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </Card>

            <Button size="lg" className="w-full h-16 rounded-2xl text-xl gap-2 shadow-lg shadow-primary/20" onClick={startDelivery}>
                <Send className="w-6 h-6" /> Start Task
            </Button>
        </div>
      )}

      {/* Status Screen */}
      {view === "status" && (
         <div className="flex flex-col items-center justify-center flex-1 text-center space-y-8 animate-in zoom-in-95 duration-500">
            <div className="relative">
                <div className="absolute inset-0 bg-green-400 blur-3xl opacity-20 rounded-full animate-pulse" />
                <div className="w-48 h-48 bg-white border-4 border-green-100 rounded-full flex items-center justify-center relative z-10 shadow-xl">
                    <Truck className="w-20 h-20 text-green-500" />
                </div>
            </div>

            <div className="space-y-2">
                <h2 className="text-3xl font-bold text-foreground">Task Started</h2>
                <p className="text-xl text-muted-foreground">{statusMessage}</p>
            </div>

            <Card className="w-full p-4 bg-muted/50 rounded-2xl">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="font-medium">ETA: 2 minutes</span>
                </div>
            </Card>

            <Button variant="secondary" size="lg" className="w-full rounded-2xl mt-8" onClick={() => setView("menu")}>
                Cancel / Return
            </Button>
             <VoiceStatus state="processing" text="Navigating to destination..." />
         </div>
      )}
    </div>
  );
}
