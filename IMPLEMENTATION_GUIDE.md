# Production-Level Voice Interaction System - Implementation Guide

## Overview

A professional, state-machine-driven speech interaction system for a campus kiosk with strict overlap prevention, intelligent timing, and structured conversation flow.

---

## Architecture

### 1. **State Machine** (`ConversationState`)

```
idle → listening → processing → speaking → [listening | idle | navigating]
                        ↓
                  waiting_response (3s grace)
```

**States:**

- `idle`: Mic off, no activity
- `listening`: Mic on, actively listening
- `processing`: User speech received, analyzing
- `speaking`: Bot speaking (listening disabled)
- `waiting_response`: Greeting grace period (3 seconds)
- `navigating`: In guidance/navigation mode
- `error`: Error state

---

## 2. Mic Control (`MicrophoneControl.tsx`)

### Visual Indicators

- **Mic ON**: Blue button, active state
- **Mic OFF**: Gray button, inactive state
- **Listening**: Green dot + pulse ring animation
- **Speaking**: Red dot + pulse animation
- **Ready**: Gray dot

### Behavior

```tsx
toggleMic(enabled: boolean)
├─ enabled = true
│  ├─ Start speech recognition
│  ├─ Show "Listening..." UI
│  └─ Schedule auto-reset timer
└─ enabled = false
   ├─ Stop recognition immediately
   ├─ Clear pending timeouts
   └─ Hide all animations
```

---

## 3. Intent Detection

### Intent Types

| Intent       | Patterns                           | Confidence |
| ------------ | ---------------------------------- | ---------- |
| `greeting`   | hello, hi, hey, guido              | 0.95       |
| `navigation` | where, location, directions, go to | 0.85       |
| `guide`      | guide, lead, follow, come with me  | 0.90       |
| `help`       | help, info, explain, tell          | 0.80       |
| `stop`       | stop, cancel, emergency            | 0.95       |
| `unknown`    | anything else                      | 0.0        |

### Confidence Threshold

- Only process intents with confidence > 0.7
- For ambiguous input → respond: "I'm sorry, I didn't understand that. Could you please repeat?"

---

## 4. Greeting Behavior (STRICT)

### Trigger

User says: "Hello", "Hi", "Hey", "Guido"

### Flow

```
1. User finishes speech
   ↓
2. System enters "waiting_response" state
   ↓
3. Start 3-second timer
   ↓
4. If additional speech detected within 3s
   └─ Cancel timer, process normally
   ↓
5. If no additional speech after 3s
   └─ Respond: "Welcome! How can I assist you today?"
   └─ Re-enable mic for next command
```

### Duration

- **Wait**: Exactly 3 seconds
- **No Less**: Would feel too robotic
- **No More**: Would feel slow

---

## 5. Response Flow Control

### Critical Rule: Never Overlap

```typescript
// FORBIDDEN
isSpeaking && isListening  // ❌ Never true simultaneously

// FORCED SEQUENCE
isListening → SPEECH → isSpeaking → (wait for speechSynthesis.onend) → isListening
```

### Implementation

```typescript
const speakAndResume = async (text: string, shouldResume: boolean) => {
  // Step 1: STOP LISTENING
  if (isListening) {
    stopSpeechRecognition();
    setIsListening(false);
  }

  // Step 2: SPEAK
  setIsSpeaking(true);
  await speakAsync(text); // Waits for speech to finish

  // Step 3: RESUME LISTENING (if allowed)
  setIsSpeaking(false);
  if (shouldResume) {
    setIsListening(true);
    startSpeechRecognition();
  }
};
```

---

## 6. Navigation Flow

### User Says: "Where is A Block?" or "Directions to Admin"

```
1. Intent detected: "navigation"
2. Extract destination (A_BLOCK, ADMIN, etc.)
3. Bot speaks directions
4. Bot asks: "Would you like me to guide you there?"
5. Show directions panel
6. Await user response
```

### User Says: "Yes, guide me" or "Guide me"

```
1. Intent detected: "guide"
2. DISABLE MIC IMMEDIATELY
3. Set navigationMode = "guiding"
4. Enter guided navigation loop
5. Show step-by-step directions
6. Bot speaks each direction
7. User presses "Next" button to continue
```

### When Destination Reached

```
1. Bot says: "You have reached your destination."
2. Wait 2 seconds
3. Redirect to home page
4. Reset state
5. Re-enable mic
```

---

## 7. Auto-Reset (60 Seconds)

### Triggers

- No mic interaction for 60 seconds
- User walks away (inferred from inactivity)

### What Happens

```
1. Clear all timers
2. Reset conversation state to idle
3. Set navigationMode = none
4. Disable mic
5. Redirect to home page
6. Clear transcript & directions
```

### Timer Implementation

```typescript
scheduleAutoReset = () => {
  clearTimeout(autoResetTimeoutRef.current);
  autoResetTimeoutRef.current = setTimeout(() => {
    resetToLanding();
  }, 60000); // 60 seconds
};

// Called on every user interaction
// Prevents orphaned bot states
```

---

## 8. Error Handling

### If Text-to-Speech Fails

- Gracefully catch error
- Continue to resume listening
- Don't crash or get stuck in "speaking" state

### If Speech Recognition Fails

- Show error toast
- Suggest using buttons
- Allow retry

### If Intent Processing Fails

- Respond: "I'm sorry, I didn't understand that. Could you please repeat?"
- Keep mic open for retry

---

## 9. UX Principles

### Visual Feedback

✅ Clear mic state (on/off)  
✅ Listening animation only when active  
✅ Speaking doesn't show microphone icon  
✅ Status text ("Listening...", "Bot speaking...", "Ready")

### Audio Feedback

✅ Clear, calm speech (rate: 1.0, pitch: 1.0)  
✅ No overlapping audio  
✅ Proper pause between bot and user

### Interaction

✅ Large, touch-friendly buttons  
✅ No spam responses  
✅ Intelligent waiting (greeting grace period)  
✅ No double-triggering

---

## 10. File Structure

```
FRONTEND/client/src/
├── context/
│   └── VoiceController.tsx          # State machine (production)
├── components/
│   └── MicrophoneControl.tsx        # Mic toggle + visual indicators
├── hooks/
│   └── use-speech.ts               # Speech Recognition API wrapper
├── pages/
│   └── VisitorHelp.tsx             # Navigation UI
└── lib/
    └── voice.ts                    # Intent API (if using backend)
```

---

## 11. Testing Scenarios

### Scenario 1: Basic Greeting

1. User: "Hello"
2. System waits 3 seconds
3. System: "Welcome! How can I assist you today?"
4. Mic re-opens

### Scenario 2: Navigation Request

1. User: "Where is the library?"
2. Bot: Shows directions + speaks them
3. System asks if user wants guidance

### Scenario 3: Guided Navigation

1. User: "Guide me"
2. Mic disables
3. Bot speaks: "Please follow me. I will guide you safely."
4. Show step-by-step directions
5. User navigates with buttons
6. Destination reached → reset

### Scenario 4: Timeout / Walkaway

1. No interaction for 60 seconds
2. Auto-reset triggers
3. Return to home page
4. Reset state

### Scenario 5: Error/Unclear Input

1. User: "XYZ something random"
2. Bot: "I'm sorry, I didn't understand that. Could you please repeat?"
3. Mic stays open for retry

---

## 12. Key Functions

### `toggleMic(enabled: boolean)`

Enables/disables microphone with full state management.

### `dispatch(intent: Intent, data?: any)`

Processes intents and triggers appropriate handlers.

### `speakAndResume(text: string, shouldResume: boolean)`

Ensures mic is off while bot speaks, then resumes intelligently.

### `detectIntent(transcript: string)`

Returns intent + confidence score.

### `scheduleAutoReset()`

Resets conversation state after 60 seconds of inactivity.

---

## 13. Production Checklist

✅ State machine implemented  
✅ No overlapping listening/speaking  
✅ Greeting with 3-second grace period  
✅ Auto-reset after 60 seconds  
✅ Visual feedback for all states  
✅ Error handling for all edge cases  
✅ Proper timing and delays  
✅ Intent detection with confidence  
✅ Navigation & guidance flows  
✅ Clean, maintainable code

---

## 14. Performance Considerations

- **Speech Recognition**: Runs continuously when mic ON
- **Timeout Cleanup**: Cleared on every interaction
- **Speech Synthesis**: Non-blocking await pattern
- **State Updates**: Minimal re-renders due to useCallback

---

## 15. Future Enhancements (Optional)

- [ ] Multilingual support
- [ ] Confidence scoring visualization
- [ ] Natural language processing (OpenAI/Claude)
- [ ] Emotion detection
- [ ] User preference learning
- [ ] Analytics & interaction logs

---

**Last Updated**: March 1, 2026  
**Version**: 1.0 (Production)  
**Status**: ✅ Ready for deployment
