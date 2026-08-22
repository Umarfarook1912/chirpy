# CHIRPY — Google Meet Integration

## Important Warning

Google Meet is a **third-party platform**. Its DOM structure, CSS selectors, and internal behavior
can change at any time without notice. All Meet-specific code is isolated in:

```
apps/extension/src/content/adapters/GoogleMeetAdapter.ts
```

Never reference Google Meet DOM selectors outside this file.

---

## Signal Feasibility

| Signal | Method | Classification | Notes |
|---|---|---|---|
| Meeting detection | URL + page title | Reliable | `meet.google.com/xxx-xxxx-xxx` pattern is stable |
| Meeting join/leave | MutationObserver on `<title>` | Reliable | Title changes reliably on join/leave |
| Participant list | MutationObserver on participant panel | Potentially Reliable | Selectors may break on Meet updates |
| Participant join/leave | MutationObserver on participant list | Potentially Reliable | Same fragility caveat |
| Chat messages (own) | MutationObserver on chat panel | Potentially Reliable | Only when chat panel is open |
| Hand raises | MutationObserver on hand UI | Requires POC | Selector stability unknown |
| Reactions | MutationObserver on reaction overlay | Requires POC | Short-lived DOM nodes |
| Speaking (own mic) | AudioContext + AnalyserNode | Potentially Reliable | Own mic only |
| Speaking (others via DOM) | MutationObserver on speaking ring | Requires POC | Fragile — Google Meet speaking indicators |
| Tab audio capture | `getDisplayMedia({ audio: true })` | Potentially Reliable | Requires user permission |
| Screen/tab recording | `getDisplayMedia({ video, audio })` | Reliable | Well-supported in Chrome |
| Microphone capture | `getUserMedia({ audio: true })` | Reliable | Standard Web API |

---

## Adapter Interface

```ts
interface MeetingPlatformAdapter {
  detectMeeting(): MeetingInfo | null;
  onParticipantChange(cb: (participants: Participant[]) => void): () => void;
  onChatMessage(cb: (message: ChatEvent) => void): () => void;
  onSpeakingChange(cb: (participantId: string, speaking: boolean) => void): () => void;
  destroy(): void;
}
```

Returning `null` or empty arrays is always valid — never fabricate data.

---

## Version Guard

When implementing DOM-based detectors, always:

1. Check that the selector resolves to a non-null element
2. Log a warning if the selector stops working (do not throw)
3. Fall back to `null` / empty data
4. Document the selector with the date it was verified

---

## Cross-Origin Limitations

Google Meet runs on `meet.google.com`. Cross-origin audio streams from other participants are
**not accessible** without tab capture (`getDisplayMedia`). Do not attempt to access audio streams
from other participants via any other method.

---

## Future Platform Support

The adapter pattern allows future platforms:

```ts
// apps/extension/src/content/adapters/
MeetingPlatformAdapter.ts   // Interface
GoogleMeetAdapter.ts        // Implemented
MicrosoftTeamsAdapter.ts    // Future
ZoomAdapter.ts              // Future
```
