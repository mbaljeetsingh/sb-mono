// useVideoRenderWebCodecs — hardware-accelerated client-side composite render.
//
// Pipeline (all in-browser):
//   1. Caller drives the overlay's reactive state across the timeline and
//      hands us pre-rasterized snapshots as ImageBitmaps. This sidesteps the
//      slow video-seek-per-snapshot loop.
//   2. mp4box.js demuxes the source MP4 → video codec config + sample list.
//   3. VideoDecoder turns each video sample into a VideoFrame using the
//      browser's hardware H.264/HEVC/VP9/AV1 decoder.
//   4. For each frame: draw the frame to an OffscreenCanvas, then draw the
//      currently-active overlay ImageBitmap on top (chosen by frame
//      timestamp against the snapshot times).
//   5. VideoEncoder re-encodes the canvas as H.264 chunks using the
//      browser's hardware encoder.
//   6. mp4-muxer packages the chunks into a fresh MP4 buffer.
//
// Audio is currently dropped (v1 limitation). AAC passthrough requires
// extracting the AudioSpecificConfig from the source's esds box and
// forwarding it to the muxer's `decoderConfig`. Wiring that up is a small
// follow-up — for now the output is a silent MP4. Operators can re-attach
// audio from the source file in an editor (single track combine).

import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import {
  DataStream,
  Endianness,
  type MP4BoxBuffer,
  type Movie,
  type Sample,
  createFile,
} from 'mp4box';
import { type Ref, computed, ref } from 'vue';

export type RenderProgress = {
  stage: 'idle' | 'demuxing' | 'encoding' | 'finalizing' | 'done' | 'error';
  ratio?: number;
  message?: string;
};

export type OverlaySnapshot = { videoTimeSec: number; bitmap: ImageBitmap };

type DemuxResult = {
  videoCodec: string;
  videoCodecMuxer: 'avc' | 'hevc' | 'vp9' | 'av1';
  videoDescription: Uint8Array;
  width: number;
  height: number;
  timescale: number;
  videoSamples: Array<{
    data: Uint8Array;
    is_sync: boolean;
    cts: number;
    dts: number;
    duration: number;
  }>;
  audio: {
    codec: 'aac' | 'opus';
    description: Uint8Array; // AudioSpecificConfig for AAC, Opus head for Opus
    sampleRate: number;
    channels: number;
    timescale: number;
    samples: Array<{
      data: Uint8Array;
      is_sync: boolean;
      cts: number;
      duration: number;
    }>;
  } | null;
};

// Build a 2-byte AAC AudioSpecificConfig from the parsed sample rate /
// channel count / profile. This is what the muxer's audio decoderConfig
// description needs, and it's much simpler than walking the parsed esds
// descriptor tree mp4box exposes. Covers AAC-LC at standard sample rates
// (96k–7350) up to 7 channels — i.e. ~all phone/camera recordings.
const buildAacAsc = (
  sampleRate: number,
  channelCount: number,
  codec: string
): Uint8Array | null => {
  const freqMap = [
    96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025,
    8000, 7350,
  ];
  const profile = Number.parseInt(codec.split('.')[2] ?? '2', 10);
  const freqIndex = freqMap.indexOf(sampleRate);
  if (freqIndex < 0 || channelCount < 1 || channelCount > 7) return null;
  const b0 = (profile << 3) | (freqIndex >> 1);
  const b1 = ((freqIndex & 1) << 7) | (channelCount << 3);
  return new Uint8Array([b0 & 0xff, b1 & 0xff]);
};

const audioCodecMuxerKind = (codec: string): 'aac' | 'opus' | null => {
  if (codec.startsWith('mp4a')) return 'aac';
  if (codec.startsWith('opus') || codec.startsWith('Opus')) return 'opus';
  return null;
};

// Pull the codec-specific config box (avcC / hvcC / vpcC / av1C) out of a
// track and serialize it as the Uint8Array that VideoDecoder expects.
// mp4box doesn't export a usable type for the trak box tree, so model just
// the path we walk.
type CodecConfigBox = { write: (ds: DataStream) => void };
type TrakBoxLike = {
  mdia?: {
    minf?: {
      stbl?: {
        stsd?: {
          entries?: Partial<
            Record<'avcC' | 'hvcC' | 'vpcC' | 'av1C', CodecConfigBox>
          >[];
        };
      };
    };
  };
};

const extractCodecDescription = (trak: TrakBoxLike): Uint8Array | null => {
  const entry = trak?.mdia?.minf?.stbl?.stsd?.entries?.[0];
  if (!entry) return null;
  const box = entry.avcC ?? entry.hvcC ?? entry.vpcC ?? entry.av1C;
  if (!box) return null;
  const ds = new DataStream(undefined, 0, Endianness.BIG_ENDIAN);
  box.write(ds);
  // First 8 bytes are box header (size + name), VideoDecoder wants the body.
  return new Uint8Array(ds.buffer, 8);
};

const pickAvcCodec = (width: number, height: number): string => {
  const px = width * height;
  if (px <= 1280 * 720) return 'avc1.42E01F';
  if (px <= 1920 * 1088) return 'avc1.4D4028';
  if (px <= 2560 * 1440) return 'avc1.4D4032';
  return 'avc1.640033';
};

const codecToMuxerKind = (
  codec: string
): 'avc' | 'hevc' | 'vp9' | 'av1' | null => {
  if (codec.startsWith('avc1') || codec.startsWith('avc3')) return 'avc';
  if (codec.startsWith('hvc1') || codec.startsWith('hev1')) return 'hevc';
  if (codec.startsWith('vp09')) return 'vp9';
  if (codec.startsWith('av01')) return 'av1';
  return null;
};

const demuxFile = (videoBlob: Blob): Promise<DemuxResult> =>
  new Promise((resolve, reject) => {
    const file = createFile();
    const videoSamples: DemuxResult['videoSamples'] = [];
    let videoMeta: Omit<DemuxResult, 'videoSamples' | 'audio'> | null = null;
    let videoTrackId: number | null = null;
    let audioTrackId: number | null = null;
    let audioMeta: Omit<NonNullable<DemuxResult['audio']>, 'samples'> | null =
      null;
    const audioSamples: NonNullable<DemuxResult['audio']>['samples'] = [];

    file.onError = (e: string) => reject(new Error(`mp4box: ${e}`));

    file.onReady = (info: Movie) => {
      const v = info.videoTracks?.[0];
      if (!v) {
        reject(new Error('No video track in source file'));
        return;
      }
      if (!v.video) {
        reject(new Error('Video track has no video metadata'));
        return;
      }
      const trak = file.getTrackById(v.id);
      const description = extractCodecDescription(
        trak as unknown as TrakBoxLike
      );
      if (!description) {
        reject(new Error(`Could not extract codec config from ${v.codec}`));
        return;
      }
      const muxerKind = codecToMuxerKind(v.codec);
      if (!muxerKind) {
        reject(new Error(`Unsupported video codec: ${v.codec}`));
        return;
      }
      videoTrackId = v.id;
      videoMeta = {
        videoCodec: v.codec,
        videoCodecMuxer: muxerKind,
        videoDescription: description,
        width: v.video.width,
        height: v.video.height,
        timescale: v.timescale,
      };
      file.setExtractionOptions(v.id, null, { nbSamples: 100 });

      // Audio — best-effort passthrough. AAC is the common case for phone
      // recordings; Opus comes up for browser-recorded WebM-in-MP4.
      const a = info.audioTracks?.[0];
      if (a?.audio) {
        const aKind = audioCodecMuxerKind(a.codec);
        if (aKind === 'aac') {
          const asc = buildAacAsc(
            a.audio.sample_rate,
            a.audio.channel_count,
            a.codec
          );
          if (asc) {
            audioTrackId = a.id;
            audioMeta = {
              codec: 'aac',
              description: asc,
              sampleRate: a.audio.sample_rate,
              channels: a.audio.channel_count,
              timescale: a.timescale,
            };
            file.setExtractionOptions(a.id, null, { nbSamples: 100 });
          }
        }
        // Opus passthrough left as a future expansion — requires extracting
        // the OpusHead from the dOps box. Skip silently for now.
      }

      file.start();
    };

    file.onSamples = (id: number, _user: unknown, samples: Sample[]) => {
      if (id === videoTrackId) {
        for (const s of samples) {
          // mp4box types `data` as optional; a sample without bytes is useless.
          if (!s.data) continue;
          videoSamples.push({
            data: s.data,
            is_sync: s.is_sync,
            cts: s.cts,
            dts: s.dts,
            duration: s.duration,
          });
        }
      } else if (id === audioTrackId) {
        for (const s of samples) {
          if (!s.data) continue;
          audioSamples.push({
            data: s.data,
            is_sync: s.is_sync,
            cts: s.cts,
            duration: s.duration,
          });
        }
      }
    };

    // Read the full blob first, then appendBuffer once. Streaming the blob
    // breaks for files whose `moov` (metadata) box is at the END of the
    // file — common for camera recordings — because mp4box has to seek
    // backwards to read the `mdat` sample bytes after parsing `moov`, and
    // we'd have already discarded those earlier buffers in a streaming
    // pump. Reading the whole file gives mp4box random access.
    videoBlob
      .arrayBuffer()
      .then((ab) => {
        const buf = ab as MP4BoxBuffer;
        buf.fileStart = 0;
        file.appendBuffer(buf);
        file.flush();
        if (!videoMeta) {
          reject(new Error('mp4box never reached onReady'));
          return;
        }
        resolve({
          ...videoMeta,
          videoSamples,
          audio: audioMeta ? { ...audioMeta, samples: audioSamples } : null,
        });
      })
      .catch(reject);
  });

// Pick the most-recent overlay snapshot whose videoTime <= t. First snapshot
// is treated as active for any t before its videoTime too, so 0–0 sits over
// pre-roll footage.
const pickActiveOverlay = (
  snapshots: OverlaySnapshot[],
  tSec: number
): OverlaySnapshot | null => {
  if (snapshots.length === 0) return null;
  let active = snapshots[0]!;
  for (const s of snapshots) {
    if (s.videoTimeSec <= tSec) active = s;
    else break;
  }
  return active;
};

export function useVideoRenderWebCodecs() {
  const progress = ref<RenderProgress>({ stage: 'idle' });
  const outputUrl = ref<string | null>(null);

  const isSupported = computed(
    () =>
      typeof window !== 'undefined' &&
      'VideoEncoder' in window &&
      'VideoDecoder' in window
  );

  const render = async (params: {
    videoBlob: Blob;
    overlaySnapshots: OverlaySnapshot[];
    /**
     * Optional clip window in source-video seconds. When set, only this
     * range is decoded/encoded (decode starts at the nearest keyframe at or
     * before startSec; frames before the in-point are decoded but dropped)
     * and output timestamps are rebased so the clip starts at 0. Overlay
     * snapshots stay in FULL-video time — they're matched against the
     * source timestamp before rebasing.
     */
    range?: { startSec: number; endSec: number };
  }): Promise<Blob> => {
    if (!isSupported.value) {
      throw new Error(
        'WebCodecs not supported in this browser — try Chrome/Edge or Safari 16.4+'
      );
    }
    // A full render with no overlay states would just re-encode the source —
    // refuse it. A CLIP with no snapshots is deliberate: clean footage, cut
    // to the window, no score bug.
    if (params.overlaySnapshots.length === 0 && !params.range) {
      throw new Error('no snapshots — sync at least one game first');
    }
    if (params.range && params.range.endSec <= params.range.startSec) {
      throw new Error('clip range is empty');
    }
    outputUrl.value = null;

    // 1) Demux source.
    progress.value = { stage: 'demuxing', message: 'Reading video…' };
    const demux = await demuxFile(params.videoBlob);

    const range = params.range ?? null;
    const rangeStartUs = range ? Math.max(0, range.startSec * 1_000_000) : 0;
    const rangeEndUs = range
      ? range.endSec * 1_000_000
      : Number.POSITIVE_INFINITY;

    // Clip renders feed a sample subset: from the last keyframe at or before
    // the in-point (delta frames can't decode without it) through the last
    // sample inside the window. Presentation order ~= decode order for
    // phone/camera H.264; a B-frame right at the boundary costs at most one
    // dropped frame, not corruption.
    let feedSamples = demux.videoSamples;
    if (range) {
      const sampleUs = (cts: number) => (cts * 1_000_000) / demux.timescale;
      let keyIdx = 0;
      for (let i = 0; i < demux.videoSamples.length; i++) {
        const s = demux.videoSamples[i]!;
        if (sampleUs(s.cts) > rangeStartUs) break;
        if (s.is_sync) keyIdx = i;
      }
      const subset: typeof demux.videoSamples = [];
      for (let i = keyIdx; i < demux.videoSamples.length; i++) {
        const s = demux.videoSamples[i]!;
        if (sampleUs(s.cts) > rangeEndUs) break;
        subset.push(s);
      }
      if (subset.length === 0) {
        throw new Error('clip range contains no video samples');
      }
      feedSamples = subset;
    }

    // 2) Set up muxer (video-only for now).
    progress.value = { stage: 'encoding', message: 'Encoding video…' };
    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: {
        codec: 'avc',
        width: demux.width,
        height: demux.height,
      },
      audio: demux.audio
        ? {
            codec: demux.audio.codec,
            numberOfChannels: demux.audio.channels,
            sampleRate: demux.audio.sampleRate,
          }
        : undefined,
      fastStart: 'in-memory',
      // Source videos often have a non-zero composition timestamp on the
      // first sample (small DTS offset from the muxing tool). Without this,
      // mp4-muxer rejects every chunk because it expects timestamps
      // anchored at 0. 'cross-track-offset' aligns video + audio together
      // so they stay in sync after the shift.
      firstTimestampBehavior: 'cross-track-offset',
    });

    // 3) Canvas matches source resolution. drawImage(VideoFrame, 0, 0) then
    //    drawImage(overlay ImageBitmap, 0, 0). Force sRGB so the canvas has a
    //    defined colorSpace — without this, some Chromium versions throw
    //    "Cannot read properties of null (reading 'colorSpace')" when we hand
    //    the canvas to the VideoFrame constructor.
    const canvas = new OffscreenCanvas(demux.width, demux.height);
    const ctx = canvas.getContext('2d', { colorSpace: 'srgb' });
    if (!ctx) throw new Error('OffscreenCanvas 2D context unavailable');

    // 4) Encoder — bitrate scales loosely with resolution.
    const bitrate = Math.max(
      2_000_000,
      Math.min(20_000_000, demux.width * demux.height * 4)
    );

    // Check codec support before configuring so we fail with a clear message
    // instead of silently producing zero chunks (which then crashes
    // mp4-muxer.finalize on a null decoderConfig).
    //
    // Codec string must declare an AVC level that covers the source
    // resolution — L3.1 caps at 720p, L4.0 at 1080p, L5.0 at 1440p, L5.1 at
    // 4K. Picking too low a level makes Chrome 148+ reject the config (older
    // Chrome silently downshifted to a slow software path).
    const encoderConfig: VideoEncoderConfig = {
      codec: pickAvcCodec(demux.width, demux.height),
      width: demux.width,
      height: demux.height,
      bitrate,
      framerate: 30,
      // mp4-muxer needs length-prefixed NAL units ('avc' format).
      avc: { format: 'avc' },
      // Prefer the HW encoder explicitly — most browsers pick HW by default
      // but this avoids a SW fallback when both paths are available.
      hardwareAcceleration: 'prefer-hardware',
      // Realtime mode is the encoder hint for "low-latency, fewer reorders"
      // — encodes faster at a slight bitrate efficiency cost. For our
      // overlay-composite case (no rate-control nuance needed) it's a clear
      // win.
      latencyMode: 'realtime',
    };
    const support = await VideoEncoder.isConfigSupported(encoderConfig);
    if (!support.supported) {
      throw new Error(
        `Encoder config not supported (codec=${encoderConfig.codec}, ${demux.width}×${demux.height})`
      );
    }

    let encoderError: unknown = null;
    let decoderError: unknown = null;
    let chunkCount = 0;
    let savedMeta: EncodedVideoChunkMetadata | undefined;

    const encoder = new VideoEncoder({
      output: (chunk, meta) => {
        try {
          // VideoEncoder is only required to emit decoderConfig on the FIRST
          // chunk after configure(). mp4-muxer reads it on every addVideoChunk
          // and copies into track.info.decoderConfig — so we cache the first
          // meta and re-attach to every subsequent chunk to guarantee the
          // muxer never sees a "no decoderConfig ever arrived" state.
          if (meta?.decoderConfig) savedMeta = meta;
          const metaToUse = meta?.decoderConfig ? meta : savedMeta;
          muxer.addVideoChunk(chunk, metaToUse);
          chunkCount++;
        } catch (e) {
          console.error('[muxer] addVideoChunk failed', e, 'meta:', meta);
          encoderError = e;
        }
      },
      error: (e) => {
        console.error('[VideoEncoder]', e);
        encoderError = e;
      },
    });
    encoder.configure(encoderConfig);

    // 5) Decoder + compositor.
    const total = feedSamples.length;
    let processed = 0;
    const decoder = new VideoDecoder({
      output: (frame) => {
        try {
          // Capture timestamp/duration BEFORE drawImage in case the frame
          // gets closed mid-iteration on some browsers.
          const timestamp = frame.timestamp;
          const duration = frame.duration ?? 33_333; // 30fps fallback in µs

          // Clip render: frames decoded only to reach the in-point keyframe
          // chain (or trailing past the out-point) are dropped, not encoded.
          if (timestamp + duration <= rangeStartUs || timestamp > rangeEndUs) {
            return;
          }

          ctx.drawImage(frame, 0, 0, demux.width, demux.height);
          const active = pickActiveOverlay(
            params.overlaySnapshots,
            timestamp / 1_000_000
          );
          if (active) {
            ctx.drawImage(active.bitmap, 0, 0, demux.width, demux.height);
          }

          // Explicit colorSpace guards against the "Cannot read properties of
          // null (reading 'colorSpace')" throw on some Chromium versions when
          // the source VideoFrame's colorSpace metadata is missing.
          const composed = new VideoFrame(canvas, {
            timestamp: Math.max(0, timestamp - rangeStartUs),
            duration,
            displayWidth: demux.width,
            displayHeight: demux.height,
          });
          encoder.encode(composed);
          composed.close();
        } finally {
          frame.close();
          processed++;
          if (processed % 30 === 0 || processed === total) {
            progress.value = {
              stage: 'encoding',
              ratio: processed / total,
              message: `Encoding · ${Math.round((processed / total) * 100)}%`,
            };
          }
        }
      },
      error: (e) => {
        console.error('[VideoDecoder]', e);
        decoderError = e;
      },
    });
    const decoderConfig: VideoDecoderConfig = {
      codec: demux.videoCodec,
      codedWidth: demux.width,
      codedHeight: demux.height,
      description: demux.videoDescription,
    };
    const decoderSupport = await VideoDecoder.isConfigSupported(decoderConfig);
    if (!decoderSupport.supported) {
      throw new Error(
        `Decoder config not supported for codec ${demux.videoCodec}`
      );
    }
    decoder.configure(decoderConfig);

    // 6) Feed samples with backpressure on BOTH ends. The decoder can output
    // frames faster than the encoder accepts them; without watching encoder
    // queue size, decoded VideoFrames pile up (each holding a GPU texture)
    // until the browser kills the decoder with InvalidStateError.
    let decodedSampleCount = 0;
    let firstError: unknown = null;
    for (const s of feedSamples) {
      while (decoder.decodeQueueSize > 20 || encoder.encodeQueueSize > 20) {
        await new Promise((r) => setTimeout(r, 10));
      }
      // Decoder may have errored asynchronously; bail early to surface that.
      if (decoderError || encoderError) break;
      try {
        decoder.decode(
          new EncodedVideoChunk({
            type: s.is_sync ? 'key' : 'delta',
            timestamp: (s.cts * 1_000_000) / demux.timescale,
            duration: (s.duration * 1_000_000) / demux.timescale,
            data: s.data,
          })
        );
        decodedSampleCount++;
      } catch (e) {
        if (!firstError) firstError = e;
        console.error(
          '[render] decoder.decode threw on sample',
          decodedSampleCount,
          e
        );
        break;
      }
    }
    if (firstError && !decoderError) decoderError = firstError;
    await decoder.flush();
    await encoder.flush();
    decoder.close();
    encoder.close();

    // Surface async pipeline errors that would otherwise silently leave us
    // with zero encoded chunks and a confusing crash inside muxer.finalize.
    if (decoderError) {
      throw new Error(
        `Decoder error: ${(decoderError as Error).message ?? decoderError}`
      );
    }
    if (encoderError) {
      throw new Error(
        `Encoder error: ${(encoderError as Error).message ?? encoderError}`
      );
    }
    if (chunkCount === 0) {
      throw new Error(
        "No encoded chunks produced — the decoder likely couldn't process the source video. Check console for [VideoDecoder] errors."
      );
    }

    // Force progress to 100% — the per-30-frame update can leave the bar
    // short of full when the final batch < 30 frames.
    progress.value = {
      stage: 'encoding',
      ratio: 1,
      message: 'Encoding · 100%',
    };

    // 7) Audio passthrough — raw chunks straight into the muxer. No decode,
    //    no re-encode, no quality loss. Clip render: keep only samples that
    //    overlap the window and rebase them to the clip's zero (AAC frames
    //    are independently decodable, so cutting on a frame boundary is safe).
    if (demux.audio) {
      const a = demux.audio;
      const startAu = range ? range.startSec * a.timescale : 0;
      const endAu = range
        ? range.endSec * a.timescale
        : Number.POSITIVE_INFINITY;
      for (const s of a.samples) {
        if (s.cts + s.duration <= startAu || s.cts > endAu) continue;
        muxer.addAudioChunkRaw(
          s.data,
          s.is_sync ? 'key' : 'delta',
          (Math.max(0, s.cts - startAu) * 1_000_000) / a.timescale,
          (s.duration * 1_000_000) / a.timescale,
          {
            decoderConfig: {
              codec: 'mp4a.40.2',
              sampleRate: a.sampleRate,
              numberOfChannels: a.channels,
              description: a.description,
            },
          }
        );
      }
    }

    // 8) Finalize.
    progress.value = { stage: 'finalizing', message: 'Finalizing MP4…' };
    muxer.finalize();
    const buffer = (muxer.target as ArrayBufferTarget).buffer;
    const blob = new Blob([buffer], { type: 'video/mp4' });
    outputUrl.value = URL.createObjectURL(blob);
    progress.value = { stage: 'done', ratio: 1, message: 'Render complete' };

    return blob;
  };

  return { render, progress, outputUrl, isSupported };
}
