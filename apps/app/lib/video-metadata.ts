// Recording-time detection for the post-game render (/m/[id]/render).
//
// "Is this file the right match?" — answered from the MP4/QuickTime container
// itself: the moov→mvhd box carries creation_time + duration, written by the
// camera and preserved by any byte-copy (AirDrop, iCloud, Files, USB). Only a
// re-encode (editor export, WhatsApp compression) rewrites it. When the
// container has nothing usable (WebM, stripped metadata), we fall back to the
// filesystem's lastModified — which for a camera-roll original approximates
// when the recording FINISHED, but is reset by some transfer paths, hence
// second choice.
//
// Parsing reads only box headers (a few dozen bytes per top-level box) via
// File.slice — the multi-GB mdat payload is skipped by arithmetic, never read.

export type RecordingTime =
  | { source: 'container'; startMs: number; durationMs: number | null }
  | { source: 'file'; endMs: number };

export type RecordingFit = {
  verdict: 'likely' | 'partial' | 'unlikely';
  /** Fraction of the match's event window the recording covers, 0–1. */
  coverage: number;
  recStartMs: number;
  recEndMs: number;
  /** Where the window came from — mtime-derived verdicts deserve hedging. */
  source: RecordingTime['source'];
};

/** Seconds between the QuickTime epoch (1904-01-01) and the Unix epoch. */
const QT_EPOCH_OFFSET_S = 2_082_844_800;
/** Give up after this many top-level boxes — a sane file has well under 16. */
const MAX_TOP_LEVEL_BOXES = 64;

const readView = async (
  file: File,
  offset: number,
  length: number
): Promise<DataView | null> => {
  if (offset + length > file.size) return null;
  const buf = await file.slice(offset, offset + length).arrayBuffer();
  if (buf.byteLength < length) return null;
  return new DataView(buf);
};

type BoxHeader = { type: string; size: number; headerLen: number };

const readBoxHeader = async (
  file: File,
  offset: number
): Promise<BoxHeader | null> => {
  const head = await readView(file, offset, 8);
  if (!head) return null;
  let size: number = head.getUint32(0);
  const type = String.fromCharCode(
    head.getUint8(4),
    head.getUint8(5),
    head.getUint8(6),
    head.getUint8(7)
  );
  let headerLen = 8;
  if (size === 1) {
    // 64-bit largesize follows the type.
    const large = await readView(file, offset + 8, 8);
    if (!large) return null;
    size = Number(large.getBigUint64(0));
    headerLen = 16;
  } else if (size === 0) {
    // Box extends to end of file.
    size = file.size - offset;
  }
  if (size < headerLen) return null;
  return { type, size, headerLen };
};

const parseMvhd = async (
  file: File,
  offset: number
): Promise<{ startMs: number; durationMs: number | null } | null> => {
  // version(1) flags(3), then v0: creation(4) modification(4) timescale(4)
  // duration(4); v1 widens creation/modification/duration to 8 bytes.
  const v = await readView(file, offset, 4);
  if (!v) return null;
  const version = v.getUint8(0);
  const body = await readView(file, offset + 4, version === 1 ? 28 : 16);
  if (!body) return null;
  const creationS =
    version === 1 ? Number(body.getBigUint64(0)) : body.getUint32(0);
  const timescale = version === 1 ? body.getUint32(16) : body.getUint32(8);
  const duration =
    version === 1 ? Number(body.getBigUint64(20)) : body.getUint32(12);
  // creation 0 = "not set"; anything before the Unix epoch is garbage.
  if (creationS <= QT_EPOCH_OFFSET_S) return null;
  return {
    startMs: (creationS - QT_EPOCH_OFFSET_S) * 1000,
    durationMs:
      timescale > 0 ? Math.round((duration / timescale) * 1000) : null,
  };
};

const findContainerTime = async (
  file: File
): Promise<{ startMs: number; durationMs: number | null } | null> => {
  let offset = 0;
  for (let i = 0; i < MAX_TOP_LEVEL_BOXES && offset < file.size; i++) {
    const box = await readBoxHeader(file, offset);
    if (!box) return null;
    if (box.type === 'moov') {
      // mvhd is a direct child, almost always first.
      let child = offset + box.headerLen;
      const end = offset + box.size;
      while (child < end) {
        const c = await readBoxHeader(file, child);
        if (!c) return null;
        if (c.type === 'mvhd') return parseMvhd(file, child + c.headerLen);
        child += c.size;
      }
      return null;
    }
    offset += box.size;
  }
  return null;
};

/** Best-effort "when was this filmed" for a picked video file. */
export const readRecordingTime = async (
  file: File
): Promise<RecordingTime | null> => {
  try {
    const container = await findContainerTime(file);
    if (container) return { source: 'container', ...container };
  } catch {
    // Unparseable container — fall through to the filesystem stamp.
  }
  if (file.lastModified > 0) {
    return { source: 'file', endMs: file.lastModified };
  }
  return null;
};

/** Camera-vs-scoring-device clock skew allowance. Deliberately tight: club
 * evenings put matches 5–10 minutes apart, so a generous tolerance would let
 * the PREVIOUS match's recording pass as this one. Phone clocks are
 * NTP-synced; a few minutes covers action cameras set by hand. */
const CLOCK_SKEW_MS = 3 * 60 * 1000;

/**
 * Compare the recording's time window against the match's event window and
 * score by TRUE overlap: 'likely' = the recording covers (nearly) the whole
 * match, 'partial' = some of it (recording stopped early / started late),
 * 'unlikely' = no overlap at all — almost certainly a different match.
 *
 * The skew allowance is applied only to the 'likely' threshold: a genuinely
 * overlapping recording still clears the bar despite camera-vs-scorer clock
 * drift, but padding the overlap itself would let the PREVIOUS match's clip
 * (gaps under 3 minutes on a club evening) score as a fit for this one.
 *
 * Duration fallbacks, in order: the container's own value, the mounted
 * <video>'s duration, then "assume it at least spans the match" — the last
 * keeps mtime-only files rankable before any of them is mounted. Returns
 * null when there's nothing to compare (no rec, no match window, or a
 * zero-width window such as a walkover).
 */
export const assessRecordingFit = (
  rec: RecordingTime | null,
  videoDurationMs: number,
  matchStartMs: number | null,
  matchEndMs: number | null
): RecordingFit | null => {
  if (!rec || matchStartMs === null || matchEndMs === null) return null;
  const matchDurationMs = matchEndMs - matchStartMs;
  if (matchDurationMs <= 0) return null;
  // `> 0`, not `!== null`: fragmented MP4s and crash-truncated files carry
  // an mvhd duration of 0, which must fall through, not win.
  const containerDurationMs =
    rec.source === 'container' && rec.durationMs !== null && rec.durationMs > 0
      ? rec.durationMs
      : null;
  const duration =
    containerDurationMs ??
    (videoDurationMs > 0 ? videoDurationMs : matchDurationMs);
  const recStartMs =
    rec.source === 'container' ? rec.startMs : rec.endMs - duration;
  const recEndMs = recStartMs + duration;
  const trueOverlapMs =
    Math.min(recEndMs, matchEndMs) - Math.max(recStartMs, matchStartMs);
  const paddedOverlapMs =
    Math.min(recEndMs + CLOCK_SKEW_MS, matchEndMs) -
    Math.max(recStartMs - CLOCK_SKEW_MS, matchStartMs);
  const coverage = Math.min(1, Math.max(0, trueOverlapMs / matchDurationMs));
  const verdict =
    trueOverlapMs <= 0
      ? 'unlikely'
      : paddedOverlapMs / matchDurationMs >= 0.9
        ? 'likely'
        : 'partial';
  return { verdict, coverage, recStartMs, recEndMs, source: rec.source };
};

export type RankedRecording = {
  file: File;
  time: RecordingTime | null;
  fit: RecordingFit | null;
};

/**
 * "I filmed the whole evening — which file is this match?" Parse every
 * candidate's container timestamp and rank by coverage of the match window,
 * best first. Files without container metadata are windowed from their mtime
 * with a match-length duration assumption (see assessRecordingFit), so an
 * all-mtime session still ranks by timing instead of OS enumeration order.
 */
export const rankRecordings = async (
  files: readonly File[],
  matchStartMs: number,
  matchEndMs: number
): Promise<RankedRecording[]> => {
  const ranked = await Promise.all(
    files.map(async (file) => {
      const time = await readRecordingTime(file);
      const fit = assessRecordingFit(time, 0, matchStartMs, matchEndMs);
      return { file, time, fit };
    })
  );
  return ranked.sort(
    (a, b) => (b.fit?.coverage ?? -1) - (a.fit?.coverage ?? -1)
  );
};
