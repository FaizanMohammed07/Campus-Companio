import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { sendVoiceCommand, type UiContext } from "@/lib/voice";
import { useLocation } from "wouter";

function getActionsFor(path: string): string[] {
  if (path === "/") return ["Visitor Help","Faculty & Office","Campus Information"];
  if (path === "/visitor") return ["Select Destination","Guide Me","Cancel Navigation"];
  if (path === "/faculty") return ["Call to Me","Send Item","Verify Access","Cancel / Return"];
  return [];
}

export function VoiceTest() {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const [location] = useLocation();

  async function runTest() {
    if (busy) return;
    setBusy(true);
    const uiContext: UiContext = {
      current_page: location || "/",
      available_actions: getActionsFor(location || "/"),
    };
    try {
      const resp = await sendVoiceCommand("Hi, I need help finding admissions.", uiContext);
      toast({ title: "Voice Endpoint OK", description: JSON.stringify(resp) });
    } catch (err: any) {
      toast({ title: "Voice Endpoint Error", description: err?.message || String(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button onClick={runTest} disabled={busy} variant="secondary" size="sm">
        {busy ? "Testing..." : "Test Voice Endpoint"}
      </Button>
    </div>
  );
}

export default VoiceTest;
