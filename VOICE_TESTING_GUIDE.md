# Voice System Testing Guide

## ✅ What Was Fixed

### 1. **Greeting 3-Second Wait (CRITICAL FIX)**

- User says "Hello", "Hi", "Hey", or "Guido"
- System now:
  - ✅ Detects greeting
  - ✅ Starts 3-second timer
  - ✅ **KEEPS MIC LISTENING** during the wait
  - ✅ If user continues speaking → cancels timer, processes full command
  - ✅ If user stays silent → responds after 3 seconds with "Welcome. How can I assist you today?"

### 2. **Speech Recognition Stability**

- Fixed recognition auto-restart on errors
- Added robust error handling (permission denied, service errors)
- Recognition now properly restarts if it stops unexpectedly

### 3. **Console Logging for Debugging**

- All major voice events now log to browser console
- Easy to trace what's happening at each step

---

## 🧪 How to Test

### Open Browser Console First

Press **F12** → Go to **Console** tab

### Test 1: Basic Greeting (3-Second Wait)

**Steps:**

1. Click "Mic On" button
2. Say: **"Hello"**
3. **Stay silent** for 3 seconds
4. Bot should respond: "Welcome. How can I assist you today?"

**Console Output to Expect:**

```
[Voice] Mic toggle: ON
[Voice] Mic activated, listening started
[SpeechRec] Final transcript: "hello"
[SpeechRec] Setting transcript to: "hello"
[Voice] Greeting detected, starting 3-second wait...
[Voice] 3-second wait complete, no additional speech - responding to greeting
[Voice] Bot speaking: "Welcome. How can I assist you today?"
[Voice] Bot finished speaking
[Voice] Resuming listening after bot speech...
[Voice] Mic reactivated after bot speech
```

**Visual Feedback:**

- Status bar shows: **"Waiting for more... (3s)"**
- After 3 seconds: Bot speaks and status updates

---

### Test 2: Greeting + Continuation

**Steps:**

1. Click "Mic On"
2. Say: **"Hello... where is the library?"** (pause briefly between)
3. Bot should recognize full command and give directions

**Console Output to Expect:**

```
[Voice] Mic toggle: ON
[SpeechRec] Final transcript: "hello"
[Voice] Greeting detected, starting 3-second wait...
[SpeechRec] Final transcript: "where is the library"
[Voice] User continued speaking during greeting wait, cancelling timer...
[Voice] Bot speaking: "LIBRARY is located on campus. Go to the main academic corridor. Then Follow signs for the Library in C Block..."
```

**Visual Feedback:**

- Shows "Waiting for more... (3s)" briefly
- Then processes full command
- Bot speaks directions

---

### Test 3: Direct Navigation (No Greeting)

**Steps:**

1. Mic On
2. Say: **"Where is the canteen?"**
3. Bot should give directions immediately (no 3-second wait)

**Console Output:**

```
[SpeechRec] Final transcript: "where is the canteen"
[Voice] Bot speaking: "CANTEEN is located on campus. Go to the D Block area..."
```

---

### Test 4: Button-Triggered Directions

**Steps:**

1. Go to Visitor Help page
2. Click location (e.g., "Library")
3. Click **"Show Directions"**
4. Bot should **speak** directions

**Console Output:**

```
[Voice] Bot speaking: "LIBRARY is located on campus. Go to the main academic corridor..."
```

---

### Test 5: Button-Triggered Guidance

**Steps:**

1. Visitor Help → Select location
2. Click **"Guide Me"**
3. Bot should speak: "Please follow me. I will guide you safely to your destination."
4. Should navigate to guidance page

---

## 🐛 Troubleshooting

### Issue: No Voice Recognition

**Check Console for:**

```
Microphone permission denied
```

**Fix:** Allow microphone permission in browser

---

### Issue: Bot Not Speaking

**Check Console for:**

```
[Voice] Bot speaking: "..."
[Voice] Bot finished speaking
```

**If logs show but no audio:**

- Check system volume
- Check browser isn't muted
- Try different browser (Chrome recommended)

---

### Issue: Recognition Stops After Bot Speaks

**Check Console for:**

```
[Voice] Resuming listening after bot speech...
[Voice] Mic reactivated after bot speech
```

**If missing:** Recognition restart failed
**Fix:** Code now handles this automatically

---

### Issue: Greeting Responds Too Fast

**Check Console Timeline:**

- Should show **3000ms delay** between "Greeting detected" and "3-second wait complete"
- If instant: Bug in timer logic

---

### Issue: External Voices Trigger Bot

**This is INTENTIONAL now:**

- Bot only responds to wake words: hello, hi, hey, guido
- Other sounds are ignored

---

## 📊 Expected Behavior Summary

| User Action                | Expected Behavior                  | Time      |
| -------------------------- | ---------------------------------- | --------- |
| Say "Hello" only           | Wait 3s → Respond with greeting    | 3s        |
| Say "Hello" + continue     | Cancel wait → Process full command | Immediate |
| Say "Where is..."          | Give directions immediately        | Immediate |
| Click "Show Directions"    | Speak directions + navigate        | Immediate |
| Click "Guide Me"           | Speak guide intro + navigate       | Immediate |
| Say unknown (no wake word) | Ignore (silent)                    | -         |
| Say unknown + "guido"      | Respond "I didn't understand"      | Immediate |

---

## 🔍 Key Console Log Markers

```
[Voice] Mic toggle: ON/OFF           → Button clicked
[SpeechRec] Final transcript: "..."  → User finished speaking
[Voice] Greeting detected...         → 3-second timer started
[Voice] User continued speaking...   → Timer cancelled, processing continuation
[Voice] 3-second wait complete...    → Timer fired, no more speech
[Voice] Bot speaking: "..."          → TTS started
[Voice] Bot finished speaking        → TTS ended
[Voice] Mic reactivated...           → Listening resumed
```

---

## ✨ Production Ready Features

✅ Robust speech recognition with auto-restart  
✅ 3-second greeting grace period  
✅ Continued speech detection and handling  
✅ Wake word filtering (reduces false triggers)  
✅ Comprehensive error handling  
✅ Debug logging throughout pipeline  
✅ Visual feedback during all states  
✅ Button-triggered voice actions

---

## 🚀 Next Steps

If everything works:

1. ✅ Remove console.log statements (production cleanup)
2. ✅ Add analytics/monitoring
3. ✅ Fine-tune wake word detection
4. ✅ Add multilingual support

If issues persist:

1. Check console logs for exact error
2. Verify microphone permissions
3. Test in Chrome (best Web Speech API support)
4. Check if running on HTTPS (required for mic access)

---

**Last Updated:** March 2, 2026  
**Status:** Production-Ready with Debug Logging
