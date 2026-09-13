/** Philox4x32-10, following the Random123 counter-based algorithm.
 * Algorithm: Salmon et al., Parallel Random Numbers: As Easy as 1, 2, 3 (SC11).
 * Constants and known-answer vectors: D. E. Shaw Research Random123.
 * See docs/RANDOM123-LICENSE.txt. No mutable shared random stream is used.
 */
export function mulHi(a: number, b: number): number {
  const al = a & 65535,
    ah = a >>> 16,
    bl = b & 65535,
    bh = b >>> 16;
  return (
    (ah * bh +
      Math.floor(
        (al * bh + ah * bl + Math.floor((al * bl) / 65536)) / 65536,
      )) >>>
    0
  );
}
export function philox(
  id: number,
  block: number,
  replicate: number,
  domain: number,
  k0: number,
  k1: number,
  out: Uint32Array,
): void {
  let c0 = id >>> 0,
    c1 = block >>> 0,
    c2 = replicate >>> 0,
    c3 = domain >>> 0;
  for (let r = 0; r < 10; r++) {
    const h0 = mulHi(c0, 0xd2511f53),
      l0 = Math.imul(c0, 0xd2511f53) >>> 0;
    const h1 = mulHi(c2, 0xcd9e8d57),
      l1 = Math.imul(c2, 0xcd9e8d57) >>> 0;
    c0 = (h1 ^ c1 ^ k0) >>> 0;
    c1 = l1;
    c2 = (h0 ^ c3 ^ k1) >>> 0;
    c3 = l0;
    k0 = (k0 + 0x9e3779b9) >>> 0;
    k1 = (k1 + 0xbb67ae85) >>> 0;
  }
  out[0] = c0;
  out[1] = c1;
  out[2] = c2;
  out[3] = c3;
}
export const unit = (v: number) => (v + 0.5) / 4294967296;
export function draws(
  id: number,
  block: number,
  domain: number,
  seed: number,
  out: Uint32Array,
): void {
  philox(id, block, 0, domain, seed >>> 0, (seed ^ 0xa5b35705) >>> 0, out);
}
export function sigmoid(v: number): number {
  return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, v))));
}
export function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}
