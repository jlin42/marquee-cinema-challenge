/**
 * A QR-*looking* grid for the demo ticket: real finder and timing patterns, with the
 * data area filled deterministically from the confirmation code (same code, same
 * picture). It is not a scannable QR code. In production, encode a signed ticket token
 * with a real QR library and verify it at the door.
 */
const SIZE = 25; // modules per side (the size of a version-2 QR code)

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function random(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** SIZE×SIZE grid of dark (true) / light (false) modules. */
export function fakeQrModules(text: string): boolean[][] {
  const grid = Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false));
  const reserved = Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false));

  // Finder patterns (7×7) in three corners, each with a one-module light border.
  for (const [r0, c0] of [[0, 0], [0, SIZE - 7], [SIZE - 7, 0]] as const) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = r0 + r;
        const cc = c0 + c;
        if (rr < 0 || cc < 0 || rr >= SIZE || cc >= SIZE) continue;
        reserved[rr]![cc] = true;
        const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3));
        grid[rr]![cc] = r >= 0 && r <= 6 && c >= 0 && c <= 6 && ring !== 2;
      }
    }
  }
  // Alignment pattern (5×5) near the bottom-right, as in version 2.
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const rr = 18 + r;
      const cc = 18 + c;
      reserved[rr]![cc] = true;
      grid[rr]![cc] = Math.max(Math.abs(r), Math.abs(c)) !== 1;
    }
  }
  // Timing patterns: alternating modules along row 6 and column 6.
  for (let i = 8; i < SIZE - 8; i++) {
    reserved[6]![i] = reserved[i]![6] = true;
    grid[6]![i] = grid[i]![6] = i % 2 === 0;
  }
  // Data area: deterministic noise from the code.
  const next = random(hash(text));
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) if (!reserved[r]![c]) grid[r]![c] = next() < 0.5;
  }
  return grid;
}

/** One SVG path for all dark modules (unit squares, viewBox 0 0 SIZE SIZE). */
export function fakeQrPath(text: string) {
  return fakeQrModules(text)
    .flatMap((row, r) => row.map((dark, c) => (dark ? `M${c} ${r}h1v1h-1z` : "")))
    .join("");
}

export const FAKE_QR_SIZE = SIZE;
