class SimplexNoise {
  constructor(seed) {
    this.p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) this.p[i] = i;
    let s = Math.abs(seed || 12345) & 0xffffffff;
    for (let i = 255; i > 0; i--) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      const j = s % (i + 1);
      const t = this.p[i]; this.p[i] = this.p[j]; this.p[j] = t;
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = this.p[i & 255];
  }

  fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  lerp(a, b, t) { return a + t * (b - a); }

  grad(hash, x, y) {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }

  noise(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = this.fade(x);
    const v = this.fade(y);
    const a = this.perm[X] + Y;
    const b = this.perm[X + 1] + Y;
    return this.lerp(
      this.lerp(this.grad(this.perm[a], x, y), this.grad(this.perm[b], x - 1, y), u),
      this.lerp(this.grad(this.perm[a + 1], x, y - 1), this.grad(this.perm[b + 1], x - 1, y - 1), u),
      v
    );
  }

  octave(x, y, octaves, persistence, lacunarity) {
    let val = 0, amp = 1, freq = 1, max = 0;
    for (let i = 0; i < octaves; i++) {
      val += this.noise(x * freq, y * freq) * amp;
      max += amp;
      amp *= persistence;
      freq *= lacunarity;
    }
    return val / max;
  }
}
