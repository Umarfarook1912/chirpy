# CHIRPY — Recording

## Overview

CHIRPY provides **optional, client-side meeting recording** via the Chrome Extension.

- Recording is always **user-initiated** — never automatic
- Recordings stay on the **user's device** — no backend upload in MVP
- The recording state is **always visible** in the extension popup

---

## Recording Flow

```
User clicks "Start Recording"
         ↓
RecordingService.start()
         ↓
getDisplayMedia({ video: true, audio: true })
         ↓
[Browser permission prompt]
         ↓
MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' })
         ↓
ondataavailable → chunks[]
         ↓
User clicks "Stop Recording"
         ↓
MediaRecorder.stop() + stream tracks stopped
         ↓
new Blob(chunks, { type: 'video/webm' })
         ↓
URL.createObjectURL(blob) → download link → user saves file
```

---

## State Machine

```
idle → requesting → recording → stopping → completed → idle
              ↘ error
```

| State | UI |
|---|---|
| idle | Grey dot, "Start Recording" enabled |
| requesting | Spinner, button disabled |
| recording | Red pulsing dot, "Stop Recording" enabled, elapsed timer |
| stopping | Spinner |
| completed | Green checkmark, "Download" + "New Recording" |
| error | Red warning, error message, "Try Again" |

---

## Error Handling

| Error | Cause | Recovery |
|---|---|---|
| `NotAllowedError` | Permission denied | Show message, reset to idle |
| `NotSupportedError` | Browser/codec not supported | Show message with browser requirements |
| Track ended unexpectedly | Tab closed or meeting left | Auto-stop, offer download of partial recording |
| `MediaRecorder` error | Encoding failure | Show error, offer partial download |

---

## Browser Requirements

- Chrome 88+ (Manifest V3 minimum)
- `getDisplayMedia` must be available (requires HTTPS or localhost)
- Codec: `video/webm;codecs=vp9,opus` (preferred) with fallback detection

---

## POC Verification Checklist

Before shipping, manually verify in a real Google Meet:

- [ ] Start Recording button triggers permission prompt
- [ ] Permission denied shows helpful error
- [ ] Recording state shows red dot and elapsed timer
- [ ] Stop Recording produces a downloadable .webm file
- [ ] File opens correctly in VLC / browser
- [ ] Closing the tab during recording shows error or auto-downloads
- [ ] Starting a second recording after completion works
