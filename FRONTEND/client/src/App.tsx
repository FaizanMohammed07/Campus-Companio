import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import VisitorHelp from "@/pages/VisitorHelp";
import DirectionsPage from "@/pages/DirectionsPage";
import GuidancePage from "@/pages/GuidancePage";
import FacultyAccess from "@/pages/FacultyAccess";
import Perception from "@/pages/Perception";
import EventSetup from "@/pages/EventSetup";
import HostMode from "@/pages/HostMode";
import { StatusBar } from "@/components/StatusBar";
import { EmergencyStop } from "@/components/EmergencyStop";
import { useEffect } from "react";
import { VoiceControllerProvider } from "@/context/VoiceController";
import { MicrophoneControl } from "@/components/MicrophoneControl";
import { VoiceTest } from "@/components/VoiceTest";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/visitor" component={VisitorHelp} />
      <Route path="/directions/:id" component={DirectionsPage} />
      <Route path="/guidance/:id" component={GuidancePage} />
      <Route path="/faculty" component={FacultyAccess} />
      <Route path="/perception" component={Perception} />
      <Route path="/event-setup" component={EventSetup} />
      <Route path="/host-mode" component={HostMode} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Prevent context menu (right click) for kiosk mode feel
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <VoiceControllerProvider>
        <TooltipProvider>
          <div className="min-h-screen bg-background text-foreground font-sans select-none overflow-hidden touch-pan-y relative isolate">
            {/* Vibrant Background Blurs for "Startup Energy" */}
            <div className="fixed inset-0 -z-10 overflow-hidden">
              <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px] mix-blend-multiply animate-pulse" />
              <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/20 blur-[100px] mix-blend-multiply animate-pulse delay-1000" />
              <div className="absolute bottom-[-10%] left-[20%] w-[60%] h-[60%] rounded-full bg-blue-400/20 blur-[140px] mix-blend-multiply animate-pulse delay-2000" />
            </div>

            {/* Global UI Elements for the Robot Interface */}
            <div className="relative z-50">
              <StatusBar />
            </div>

            <EmergencyStop />
            <MicrophoneControl />
            <VoiceTest />

            {/* Main Content Area */}
            <main className="pt-12 pb-4 h-screen overflow-y-auto z-10 relative">
              <Router />
            </main>

            <Toaster />
          </div>
        </TooltipProvider>
      </VoiceControllerProvider>
    </QueryClientProvider>
  );
}

export default App;
