# Recording setups

How to record a match with Scoreboard's score visible in the footage, given whatever gear you (or a friend) brought. Ordered simplest → best.

The product question this doc answers: **what rigs do we want to support well, and what product work does each require?** Most users will only ever do one or two of these. Tier 0 + 3 (record on phone, render later) is the friend-group default; everything else is for specific situations.

## Quick picker

| You have | Best rig |
|---|---|
| Just one phone | Tier 0 (record native) + Tier 3 (render route) after match |
| Two phones | Tier 1a (live score in frame, no editing) **or** Tier 0+3 |
| DSLR + a phone | Tier 5 (DSLR clean to SD card + render route after) |
| Mac (any) | Same as above — Mac stays home unless live-streaming |
| Mac + DSLR + cables | Tier 6 (OBS live composite) **only if you want a finished file without editing or you're streaming** |
| Mac + DSLR + HDMI splitter | Tier 6c (composite + clean master) — tournament-grade |
| Group with mixed iOS/Android | Tier 0+3 universally; Tier 1a for in-venue audience |

---

## Tier 0 · Just record on phone

**Setup:** native camera app on any phone. Hit record. That's it.
**Score in video:** no — add later via the render route (Tier 3).
**Strengths:** zero setup, best image quality the phone is capable of (native ISP > in-browser), works offline.
**Weaknesses:** large files (~130 MB/min HEVC at 1080p30), no score until you edit.
**Pairs naturally with:** Tier 3 (post-render).
**Product work:** none.

## Tier 1 · Score visible at capture (optical compositing)

A screen showing `/m/[id]/scoreboard` is placed inside the camera's frame. The score becomes part of the recorded pixels with no software compositing.

### Tier 1a · Phone or tablet in frame
**Setup:** Phone A films court (native camera app). Phone/tablet B props in frame showing the scoreboard route fullscreen. Score from a third device (or B itself, if not pinned).
**Score in video:** yes — physically.
**Strengths:** zero post-production, works on any platform, no laptop, no OBS.
**Weaknesses:** a screen-shaped rectangle is permanently visible in the frame; gym lighting can glare the screen; reframing breaks the placement.
**Product work required:** kiosk display mode on `/m/[id]/scoreboard` — see ROADMAP **E1.38**. Requires E1.12 (PWA install) for cleanest experience.

### Tier 1b · Tablet or external monitor in frame
Same as 1a but the in-frame display is a tablet or small portable monitor (HDMI from a phone via USB-C dock). Looks more like a deliberate scoreboard, less like "a phone in the shot." Same product work.

## Tier 2 · In-app live composite (in-PWA recording)

**Setup:** single phone runs a future `/m/[id]/record` route. `getUserMedia` → composite overlay onto `<canvas>` → `MediaRecorder` writes file to camera roll.
**Score in video:** yes — pixel-perfect, software-composited.
**Strengths:** democratic across iOS/Android, one tap, finished file.
**Weaknesses:** image quality below native camera (in-browser MediaRecorder doesn't get the native ISP); iOS Safari MediaRecorder has codec gotchas; long matches stress phone storage; not yet built.
**Product work required:** new feature. Smaller code surface than the render route since most of the compositing engine can be reused. Not currently in ROADMAP — candidate addition only if Tier 0+3 proves insufficient for the friend-group default.

## Tier 3 · Clean record + post-production render

**Setup:** record on any phone/camera; later open `/m/[id]/render`, upload the file, anchor "first point of game N" against video time, hit Render. WebCodecs composites overlay into a downloadable MP4 in the browser.
**Score in video:** yes — burned into pixels by the render pipeline.
**Strengths:** highest quality (native camera footage + clean compositing), zero venue gear beyond a phone, works retroactively (you can even score from video playback after the fact).
**Weaknesses:** ~match-length encode time in the browser; ~20 min of operator work to anchor + render.
**Product work required:** render route exists at `/m/[id]/render` but is admin-only beta — promotion to general access is part of ROADMAP **E2.10**.

## Tier 4 · Laptop + phone-as-webcam, OBS live composite

**Setup:** phone tethered via USB to laptop as a webcam source (iPhone Continuity Camera on Mac; Camo / Iriun / DroidCam / Android USB webcam mode elsewhere). OBS scene = camera + browser-source overlay. Records composite MP4 locally.
**Score in video:** yes — live-composited by OBS.
**Strengths:** finished file at match end, no post-production, can also stream live.
**Weaknesses:** real laptop production rig (cables, OBS scene config, monitoring during match); image quality is webcam-grade (phone camera, not DSLR).
**Product work required:** none beyond the overlay route, which exists. ROADMAP **E1.37** (OBS setup doc) is the user-facing piece.

## Tier 5 · DSLR clean + render route

**Setup:** DSLR records standalone to SD card. Phone scores via `/m/[id]/control`. After match, the render route (Tier 3) burns overlay into the DSLR footage.
**Score in video:** yes — burned in by the render pipeline.
**Strengths:** best image quality available without going OBS, no laptop at the venue, the DSLR doesn't have to talk to anything.
**Weaknesses:** requires DSLR + post-production step; render-route compute scales with file size (DSLR clips are heavier than phone clips).
**Product work required:** same as Tier 3 — render route general availability (E2.10).

## Tier 6 · Laptop OBS with DSLR via HDMI capture

**Setup:** DSLR → HDMI capture dongle → laptop USB → OBS. Scene = DSLR camera + browser-source overlay. Record locally.

### Tier 6a · Live composite, record only
Best live-composite quality available. 1080p60 or 4K30 on a 16GB+ Mac; 1080p30 fine on 8GB.

### Tier 6b · Live composite + simultaneous live stream
6a but also streams to YouTube/Twitch. Free hosted archive. Requires ~6 Mbps reliable upload (5G works if signal is strong).

### Tier 6c · HDMI splitter (belt-and-braces)
DSLR → HDMI splitter → (a) capture to laptop for live composite, (b) DSLR records clean to its own SD card. End of match: a finished composite MP4 *and* a clean master. ~$20 splitter. The tournament-grade rig.

**Product work required (all 6x):** none.

## Tier 7 · Multi-cam / hardware switcher / external recorder

Multi-source OBS scene with scene cuts, or hardware switchers (Atem Mini, Roland V-1HD), or external ProRes recorders (Atomos Ninja). Broadcast / event production territory. Not in scope for product work; users supplying their own production gear point our browser-source overlay at it.

---

## Product gaps surfaced by this exercise

1. **Kiosk display mode for `/m/[id]/scoreboard`** — fullscreen, landscape-locked, edge-to-edge scaled scoreboard intended for a phone or tablet propped in the camera frame. Detect PWA standalone vs browser mode; offer install prompt to non-PWA visitors. New epic: ROADMAP **E1.38**.

2. **Render route out of admin-only beta** — `/m/[id]/render` works today (WebCodecs + `modern-screenshot`) but is gated to admin role. This is part of ROADMAP **E2.10**'s completion.

3. **Filmable scoreboard theme** — most existing themes are tuned for OBS overlay (transparent, decorative). The in-frame display use case wants edge-to-edge solid background, oversized numerals, high contrast against gym lighting. Probably one new theme entry in `packages/themes`.

4. **(Optional) In-app camera recorder** — Tier 2a. Not in ROADMAP. Build only if Tier 0+3 friction is measurably hurting friend-group adoption.

---

## Recommendations by audience

- **Friend group, casual play** → Tier 0 (record native) + Tier 3 (render later). Add Tier 1a when E1.38 ships if anyone wants live audience score.
- **Solo operator with DSLR** → Tier 5. Best quality without a venue laptop.
- **Tournament organizer** → Tier 6c. Live composite + clean master + redundancy.
- **Streamer to remote viewers** → Tier 6b.

The render route is the load-bearing feature for everything except Tiers 6–7. Investments there compound.
