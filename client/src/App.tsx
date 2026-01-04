import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import VisitorHelp from "@/pages/VisitorHelp";
import FacultyAccess from "@/pages/FacultyAccess";
import { StatusBar } from "@/components/StatusBar";
import { EmergencyStop } from "@/components/EmergencyStop";
import { CameraPreview } from "@/components/CameraPreview";
import { useEffect } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/visitor" component={VisitorHelp} />
      <Route path="/faculty" component={FacultyAccess} />
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
      <TooltipProvider>
        <div className="min-h-screen bg-background text-foreground font-sans select-none overflow-hidden touch-pan-y">
          {/* Global UI Elements for the Robot Interface */}
          <StatusBar />
          <EmergencyStop />
          <CameraPreview />
          
          {/* Main Content Area */}
          <main className="pt-12 pb-4 h-screen overflow-y-auto">
            <Router />
          </main>
          
          <Toaster />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
