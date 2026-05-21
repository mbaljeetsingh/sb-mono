// useVideoRender — client-side composite render of gameplay video + overlay.
//
// Strategy: timestamps are sparse (one event every few seconds), so we don't
// need to re-snapshot the overlay every frame. We seek the video to each
// event time, snapshot the overlay DOM at that state, then ask ffmpeg.wasm
// to drop those overlay PNGs over the video at the corresponding timestamps.
//
// Currently using single-threaded @ffmpeg/ffmpeg core to avoid the COOP/COEP
// header requirement (multi-threaded ffmpeg needs SharedArrayBuffer, which
// would force isolation headers that conflict with the Supabase auth
// callback domain). Slower, but no infra changes.

import { ref, type Ref } from "vue";
import { FFmpeg } from "@ffmpeg/ffmpeg";
// Vite-resolved URL for the ffmpeg worker module. Without this, the library
// defaults to `new Worker(new URL("./worker.js", import.meta.url))` — and
// Vite's dep optimizer rewrites that path such that the worker silently
// fails to spawn, leaving ffmpeg.load() hanging at "Initializing encoder".
import ffmpegWorkerUrl from "@ffmpeg/ffmpeg/worker?url";
import { fetchFile } from "@ffmpeg/util";
import { toPng } from "html-to-image";

const FFMPEG_VERSION = "0.12.10";
// ESM variant because our worker spawns as `type: 'module'` and the worker's
// fallback path does `await import(coreURL)` — UMD doesn't satisfy that
// (silently fails as "failed to import ffmpeg-core.js").
const FFMPEG_CDN = `https://unpkg.com/@ffmpeg/core@${FFMPEG_VERSION}/dist/esm`;

type SnapshotPoint = {
  videoTimeSec: number;
  pngBlob: Blob;
};

export type RenderProgress = {
  stage:
    | "idle"
    | "loading-ffmpeg"
    | "snapshotting"
    | "encoding"
    | "done"
    | "error";
  currentSnapshot?: number;
  totalSnapshots?: number;
  /** 0..1 progress for stages that can report it (loading-ffmpeg bytes,
   *  encoding via ffmpeg's `progress` event). */
  ratio?: number;
  message?: string;
};

export function useVideoRender(options: {
  videoEl: Ref<HTMLVideoElement | null>;
  overlayEl: Ref<HTMLElement | null>;
}) {
  const progress = ref<RenderProgress>({ stage: "idle" });
  const outputUrl = ref<string | null>(null);
  let ffmpegInstance: FFmpeg | null = null;

  // Manual fetch-with-progress so the UI can show download bytes for the
  // ffmpeg core (toBlobURL from @ffmpeg/util doesn't expose progress).
  const fetchWithProgress = async (
    url: string,
    mimeType: string,
    onProgress: (received: number, total: number) => void,
  ): Promise<string> => {
    const res = await fetch(url);
    if (!res.ok || !res.body) {
      throw new Error(`Failed to fetch ${url}: ${res.status}`);
    }
    const total = Number(res.headers.get("Content-Length") ?? 0);
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.byteLength;
        onProgress(received, total);
      }
    }
    const blob = new Blob(chunks as BlobPart[], { type: mimeType });
    return URL.createObjectURL(blob);
  };

  const loadFfmpeg = async (): Promise<FFmpeg> => {
    if (ffmpegInstance) return ffmpegInstance;
    progress.value = {
      stage: "loading-ffmpeg",
      message: "Downloading encoder (first time only)…",
      ratio: 0,
    };

    // The wasm core is ~30 MB and dwarfs the JS glue, so reporting wasm bytes
    // is a good proxy for overall load progress.
    const coreUrl = await fetchWithProgress(
      `${FFMPEG_CDN}/ffmpeg-core.js`,
      "text/javascript",
      () => {
        /* JS glue is tiny — ignore for progress */
      },
    );
    const wasmUrl = await fetchWithProgress(
      `${FFMPEG_CDN}/ffmpeg-core.wasm`,
      "application/wasm",
      (received, total) => {
        const mb = (received / 1024 / 1024).toFixed(1);
        const totalMb = total
          ? `${(total / 1024 / 1024).toFixed(1)} MB`
          : "size unknown";
        progress.value = {
          stage: "loading-ffmpeg",
          message: `Downloading encoder · ${mb} MB / ${totalMb}`,
          ratio: total ? received / total : undefined,
        };
      },
    );

    progress.value = {
      stage: "loading-ffmpeg",
      message: "Initializing encoder…",
    };
    const ffmpeg = new FFmpeg();
    ffmpeg.on("log", ({ message }) => {
      // Visible in devtools console for debugging; not surfaced to user.
      console.debug("[ffmpeg]", message);
    });
    ffmpeg.on("progress", ({ progress: p }) => {
      // `p` is 0..1 during exec; we wire this up during the encode stage.
      if (progress.value.stage === "encoding") {
        progress.value = {
          ...progress.value,
          ratio: Math.max(0, Math.min(1, p)),
          message: `Encoding · ${Math.round(p * 100)}%`,
        };
      }
    });

    // ffmpeg.load() can hang silently if the worker fails to bootstrap (the
    // common culprits are cross-origin worker restrictions, missing SAB
    // support, or the JS glue trying to import sibling assets that aren't
    // co-located with the blob URL). Race against a 60s timeout so the UI
    // surfaces a clear error instead of looking stuck forever.
    console.debug("[useVideoRender] calling ffmpeg.load()");
    const loadStart = Date.now();
    try {
      await Promise.race([
        ffmpeg.load({
          coreURL: coreUrl,
          wasmURL: wasmUrl,
          classWorkerURL: ffmpegWorkerUrl,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  "ffmpeg.load() timed out after 60s — check devtools console for the underlying error",
                ),
              ),
            60_000,
          ),
        ),
      ]);
      console.debug(
        `[useVideoRender] ffmpeg.load() ok in ${Date.now() - loadStart}ms`,
      );
    } catch (err) {
      console.error("[useVideoRender] ffmpeg.load() failed", err);
      throw err;
    }

    ffmpegInstance = ffmpeg;
    return ffmpeg;
  };

  // Seek the video to a given time and wait for the frame to actually paint
  // before we snapshot. `seeked` fires when the seek completes; an extra rAF
  // gives the video element + the overlay (reactive to videoTimeMs) one
  // paint to catch up.
  const seekVideoTo = (timeSec: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      const v = options.videoEl.value;
      if (!v) return reject(new Error("video element not mounted"));
      const onSeeked = () => {
        v.removeEventListener("seeked", onSeeked);
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      };
      v.addEventListener("seeked", onSeeked);
      v.currentTime = timeSec;
    });
  };

  // For each (videoTime) pair, seek + snapshot the overlay DOM. Returns the
  // collected PNGs ordered by videoTime ascending — that's what the ffmpeg
  // filter graph below expects.
  const collectSnapshots = async (
    snapshotTimes: number[],
  ): Promise<SnapshotPoint[]> => {
    const overlay = options.overlayEl.value;
    const video = options.videoEl.value;
    if (!overlay) throw new Error("overlay element not mounted");
    if (!video) throw new Error("video element not mounted");

    // Snapshot at the video's native resolution so the PNG covers the full
    // frame when ffmpeg overlays it. html-to-image's `pixelRatio` scales the
    // entire rasterization, so the overlay's preview-sized DOM (e.g.
    // 640px-wide bug on a 1280px-wide preview) lands at 960px on a
    // 1920px-wide frame — same 50% proportional width, no distortion.
    const overlayRect = overlay.getBoundingClientRect();
    const videoW = video.videoWidth || overlayRect.width;
    const pixelRatio = overlayRect.width > 0 ? videoW / overlayRect.width : 1;

    const sorted = [...snapshotTimes].sort((a, b) => a - b);
    const out: SnapshotPoint[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const t = sorted[i]!;
      progress.value = {
        stage: "snapshotting",
        currentSnapshot: i + 1,
        totalSnapshots: sorted.length,
        message: `Snapshot ${i + 1}/${sorted.length}`,
      };
      await seekVideoTo(t);
      // html-to-image returns a dataURL PNG. Convert to Blob so ffmpeg.wasm
      // can ingest via fetchFile.
      const dataUrl = await toPng(overlay, {
        cacheBust: true,
        pixelRatio,
        backgroundColor: undefined,
      });
      const res = await fetch(dataUrl);
      out.push({ videoTimeSec: t, pngBlob: await res.blob() });
    }
    return out;
  };

  // Build the ffmpeg command. Each snapshot becomes its own input that's
  // overlaid onto the base video for [t_i, t_{i+1}) — i.e. it stays on
  // screen until the next snapshot replaces it.
  const render = async (params: {
    videoBlob: Blob;
    snapshotTimes: number[];
  }): Promise<Blob> => {
    const ffmpeg = await loadFfmpeg();
    outputUrl.value = null;

    const snapshots = await collectSnapshots(params.snapshotTimes);
    if (snapshots.length === 0) {
      throw new Error("no snapshots — sync at least one game first");
    }

    progress.value = { stage: "encoding", message: "Encoding video…" };

    // Write video + snapshots into ffmpeg's virtual FS.
    await ffmpeg.writeFile("in.mp4", await fetchFile(params.videoBlob));
    for (let i = 0; i < snapshots.length; i++) {
      await ffmpeg.writeFile(
        `o${i}.png`,
        await fetchFile(snapshots[i]!.pngBlob),
      );
    }

    // Filter graph: chain N overlay filters, each enabled for its time
    // window. The first overlay sits on top of the video; each subsequent
    // overlay sits on top of the previous overlay's output. Each overlay PNG
    // is scaled to match the base video's dimensions first — html-to-image
    // snapshots at the preview's CSS size (which is rarely the video's
    // native resolution), so without this the overlay would land in the
    // upper-left corner of a larger frame.
    // PNGs are pre-scaled at snapshot time (via pixelRatio) to match the
    // base video's native resolution, so no ffmpeg scale step is needed.
    // The first overlay's window is extended down to t=0 so the initial
    // 0–0 state is visible during any pre-roll before the first point —
    // operators usually leave a few seconds of warmup footage before the
    // first serve and we want the scoreboard sitting at 0–0 over it.
    const filters: string[] = [];
    let last = "0:v";
    for (let i = 0; i < snapshots.length; i++) {
      const winStart = i === 0 ? 0 : snapshots[i]!.videoTimeSec;
      const next = snapshots[i + 1];
      const enableCond = next
        ? `between(t,${winStart.toFixed(3)},${next.videoTimeSec.toFixed(3)})`
        : `gte(t,${winStart.toFixed(3)})`;
      const outTag = `v${i}`;
      filters.push(
        `[${last}][${i + 1}:v]overlay=enable='${enableCond}':x=0:y=0[${outTag}]`,
      );
      last = outTag;
    }

    const args = [
      "-i",
      "in.mp4",
      ...snapshots.flatMap((_, i) => ["-i", `o${i}.png`]),
      "-filter_complex",
      filters.join(";"),
      "-map",
      `[${last}]`,
      "-map",
      "0:a?",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-crf",
      "23",
      "-c:a",
      "copy",
      "-movflags",
      "+faststart",
      "out.mp4",
    ];

    await ffmpeg.exec(args);
    const data = (await ffmpeg.readFile("out.mp4")) as Uint8Array;
    const blob = new Blob([data], { type: "video/mp4" });

    // Cleanup virtual FS so memory doesn't balloon over multiple renders.
    try {
      await ffmpeg.deleteFile("in.mp4");
      await ffmpeg.deleteFile("out.mp4");
      for (let i = 0; i < snapshots.length; i++) {
        await ffmpeg.deleteFile(`o${i}.png`);
      }
    } catch {
      // non-fatal — FS will be cleaned on next instance.
    }

    outputUrl.value = URL.createObjectURL(blob);
    progress.value = { stage: "done", message: "Render complete" };
    return blob;
  };

  return { render, progress, outputUrl };
}
