// The container parser reads real MP4/QuickTime box structure — build a
// minimal synthetic file (ftyp + moov/mvhd) byte by byte and check the
// timestamps come back in Unix ms, plus the filesystem fallback and the
// fit verdict math.

import { describe, expect, it } from 'vitest';
import {
  assessRecordingFit,
  rankRecordings,
  readRecordingTime,
} from '../video-metadata';

const QT_EPOCH_OFFSET_S = 2_082_844_800;

const box = (type: string, body: Uint8Array): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(8 + body.length);
  new DataView(out.buffer).setUint32(0, out.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  return out;
};

const concat = (...parts: Uint8Array[]): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

/** mvhd v0 body: version/flags, creation, modification, timescale, duration. */
const mvhdV0 = (creationS: number, timescale: number, duration: number) => {
  const body = new Uint8Array(20);
  const dv = new DataView(body.buffer);
  dv.setUint32(4, creationS);
  dv.setUint32(12, timescale);
  dv.setUint32(16, duration);
  return box('mvhd', body);
};

const RECORDED_AT_S = Math.floor(Date.UTC(2026, 7, 1, 4, 53, 0) / 1000);

const syntheticMov = (): File => {
  const bytes = concat(
    box('ftyp', new Uint8Array(8)),
    box('moov', mvhdV0(RECORDED_AT_S + QT_EPOCH_OFFSET_S, 1000, 720_000))
  );
  return new File([bytes], 'court.mov', { lastModified: 1 });
};

describe('readRecordingTime', () => {
  it('reads creation time and duration from the container', async () => {
    const t = await readRecordingTime(syntheticMov());
    expect(t).toEqual({
      source: 'container',
      startMs: RECORDED_AT_S * 1000,
      durationMs: 720_000,
    });
  });

  it('falls back to lastModified when the container is unparseable', async () => {
    const junk = new File([new Uint8Array(64)], 'clip.webm', {
      lastModified: 1_754_024_755_000,
    });
    const t = await readRecordingTime(junk);
    expect(t).toEqual({ source: 'file', endMs: 1_754_024_755_000 });
  });

  it('ignores an unset (zero) creation time', async () => {
    const bytes = concat(box('moov', mvhdV0(0, 1000, 1000)));
    const file = new File([bytes], 'x.mp4', { lastModified: 42 });
    const t = await readRecordingTime(file);
    expect(t).toEqual({ source: 'file', endMs: 42 });
  });
});

describe('assessRecordingFit', () => {
  const matchStart = Date.UTC(2026, 7, 1, 4, 53, 43);
  const matchEnd = Date.UTC(2026, 7, 1, 5, 5, 55);

  it('marks an overlapping container recording as likely', () => {
    const fit = assessRecordingFit(
      {
        source: 'container',
        startMs: matchStart - 60_000,
        durationMs: 800_000,
      },
      0,
      matchStart,
      matchEnd
    );
    expect(fit?.verdict).toBe('likely');
  });

  it('marks a recording from another day as unlikely', () => {
    const fit = assessRecordingFit(
      {
        source: 'container',
        startMs: matchStart + 14 * 86_400_000,
        durationMs: 800_000,
      },
      0,
      matchStart,
      matchEnd
    );
    expect(fit?.verdict).toBe('unlikely');
    expect(fit?.recEndMs).toBe(matchStart + 14 * 86_400_000 + 800_000);
  });

  it('derives the file-source window backwards from lastModified', () => {
    // mtime marks the recording END; the video element supplies the duration.
    const fit = assessRecordingFit(
      { source: 'file', endMs: matchEnd + 30_000 },
      800_000,
      matchStart,
      matchEnd
    );
    expect(fit?.verdict).toBe('likely');
    expect(fit?.recStartMs).toBe(matchEnd + 30_000 - 800_000);
  });

  it('rejects the previous match of a club evening (ended minutes earlier)', () => {
    // Recording of the match BEFORE this one: 800s long, ending 5 minutes
    // before this match's first event. Proximity is close (same evening),
    // but the windows never overlap — must be unlikely, not likely.
    const fit = assessRecordingFit(
      {
        source: 'container',
        startMs: matchStart - 300_000 - 800_000,
        durationMs: 800_000,
      },
      0,
      matchStart,
      matchEnd
    );
    expect(fit?.verdict).toBe('unlikely');
    expect(fit?.coverage).toBe(0);
  });

  it('rejects a neighbour recording even inside the skew allowance', () => {
    // Ends only 2 minutes before this match starts — closer than the 3-minute
    // skew allowance. Zero true overlap must still mean unlikely; the skew is
    // for drift on overlapping recordings, not adjacency credit.
    const fit = assessRecordingFit(
      {
        source: 'container',
        startMs: matchStart - 120_000 - 800_000,
        durationMs: 800_000,
      },
      0,
      matchStart,
      matchEnd
    );
    expect(fit?.verdict).toBe('unlikely');
    expect(fit?.coverage).toBe(0);
  });

  it('lets clock drift on an overlapping recording still count as likely', () => {
    // Camera clock 2 minutes ahead: recording window sits shifted but truly
    // overlaps most of the match. Padded threshold forgives the drift.
    const fit = assessRecordingFit(
      {
        source: 'container',
        startMs: matchStart + 120_000,
        durationMs: matchEnd - matchStart,
      },
      0,
      matchStart,
      matchEnd
    );
    expect(fit?.verdict).toBe('likely');
    expect(fit!.coverage).toBeLessThan(1);
  });

  it('marks a recording that stopped mid-match as partial', () => {
    const fit = assessRecordingFit(
      { source: 'container', startMs: matchStart, durationMs: 366_000 },
      0,
      matchStart,
      matchEnd
    );
    expect(fit?.verdict).toBe('partial');
    expect(fit!.coverage).toBeGreaterThan(0);
    expect(fit!.coverage).toBeLessThan(0.9);
  });

  it('returns null with nothing to compare', () => {
    expect(assessRecordingFit(null, 800_000, matchStart, matchEnd)).toBeNull();
    // Zero-width match window (walkover, or every event on one ts): nothing
    // meaningful to cover, so no verdict rather than a misleading one.
    expect(
      assessRecordingFit(
        { source: 'container', startMs: matchStart, durationMs: 800_000 },
        0,
        matchStart,
        matchStart
      )
    ).toBeNull();
  });

  it('windows an mtime-only file with a match-length assumption', () => {
    // No container metadata and no mounted <video> yet: assume the recording
    // at least spans the match so ranking still has a signal. mtime marks the
    // recording END.
    const fit = assessRecordingFit(
      { source: 'file', endMs: matchEnd + 30_000 },
      0,
      matchStart,
      matchEnd
    );
    expect(fit?.verdict).toBe('likely');
    expect(fit?.source).toBe('file');
  });

  it('falls back past a container duration of 0 (fragmented MP4)', () => {
    const fit = assessRecordingFit(
      { source: 'container', startMs: matchStart, durationMs: 0 },
      800_000, // mounted <video> knows the real duration
      matchStart,
      matchEnd
    );
    expect(fit?.verdict).toBe('likely');
    expect(fit?.recEndMs).toBe(matchStart + 800_000);
  });
});

describe('rankRecordings', () => {
  it('surfaces the file whose window covers the match; mtime-only files still rank', async () => {
    const movAt = (name: string, creationS: number): File =>
      new File(
        [
          concat(
            box('ftyp', new Uint8Array(8)),
            box('moov', mvhdV0(creationS + QT_EPOCH_OFFSET_S, 1000, 720_000))
          ),
        ],
        name,
        { lastModified: 1 }
      );
    const right = movAt('court-2.mov', RECORDED_AT_S);
    const previousMatch = movAt('court-1.mov', RECORDED_AT_S - 3_600);
    const noMetadata = new File([new Uint8Array(64)], 'clip.webm', {
      lastModified: 1,
    });

    // Match played inside `right`'s 720s window.
    const matchStart = (RECORDED_AT_S + 40) * 1000;
    const matchEnd = (RECORDED_AT_S + 700) * 1000;
    const ranked = await rankRecordings(
      [noMetadata, previousMatch, right],
      matchStart,
      matchEnd
    );
    // The covering file wins; the two zero-coverage candidates keep input
    // order (stable sort). The metadata-less file now gets a real (unlikely)
    // fit from its mtime instead of being unrankable.
    expect(ranked.map((r) => r.file.name)).toEqual([
      'court-2.mov',
      'clip.webm',
      'court-1.mov',
    ]);
    expect(ranked[0]!.fit?.verdict).toBe('likely');
    expect(ranked[1]!.fit?.verdict).toBe('unlikely');
    expect(ranked[1]!.fit?.source).toBe('file');
    expect(ranked[2]!.fit?.verdict).toBe('unlikely');
  });
});
