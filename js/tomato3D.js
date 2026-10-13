/**
 * Tomato3DRenderer — Photorealistic Studio Heirloom Tomato Renderer
 *
 * Uses the exact studio-lit sculpted Heirloom Tomato assets from the PRD Mockups
 * (02-hero-timer.png, 03-grid-timer.png, 04-card-front.png) combined with an exact
 * sub-pixel equatorial seam curve and per-digit 3D cylindrical projection so that:
 * - Ticks and numbers follow the exact equatorial seam curve of the tomato from edge to edge.
 * - Numbers wrap around the 3D curvature character-by-character with realistic studio shading
 *   (brighter on the key-lit left cheek, shaded on the right shadow side) and clip naturally
 *   at the physical silhouette horizon instead of fading out unnaturally.
 */

import { TomatoTop3D, TOP_GEOMETRY } from './tomatoTop3D.js?v=20261013_v59';

export const HEIRLOOM_PALETTE = {
  0: {
    name: 'Deep Crimson',
    hex: '#8B1E24',
    heroImg: 'assets/tomatoes/hero-tomato-0.png?v=20261010_v26',
    gridImg: 'assets/tomatoes/grid-tomato-0.png?v=20261010_v26',
    miniImg: 'assets/tomatoes/mini-tomato-0.png?v=20261010_v26',
  },
  1: {
    name: 'Warm Terracotta',
    hex: '#C84B31',
    heroImg: 'assets/tomatoes/hero-tomato-1.png?v=20261010_v26',
    gridImg: 'assets/tomatoes/grid-tomato-1.png?v=20261010_v26',
    miniImg: 'assets/tomatoes/mini-tomato-1.png?v=20261010_v26',
  },
  2: {
    name: 'Rich Dark Burgundy',
    hex: '#5E192A',
    heroImg: 'assets/tomatoes/hero-tomato-2.png?v=20261010_v26',
    gridImg: 'assets/tomatoes/grid-tomato-2.png?v=20261010_v26',
    miniImg: 'assets/tomatoes/mini-tomato-2.png?v=20261010_v26',
  },
  3: {
    name: 'Sun-Ripened Coral',
    hex: '#D96B52',
    heroImg: 'assets/tomatoes/hero-tomato-3.png?v=20261010_v26',
    gridImg: 'assets/tomatoes/grid-tomato-3.png?v=20261010_v26',
    miniImg: 'assets/tomatoes/mini-tomato-3.png?v=20261010_v26',
  },
  4: {
    name: 'Golden Persimmon',
    hex: '#C96A2B',
    heroImg: 'assets/tomatoes/hero-tomato-4.png?v=20261010_v26',
    gridImg: 'assets/tomatoes/grid-tomato-4.png?v=20261010_v26',
    miniImg: 'assets/tomatoes/mini-tomato-4.png?v=20261010_v26',
  },
  5: {
    name: 'Spiced Garnet',
    hex: '#9E2A3B',
    heroImg: 'assets/tomatoes/hero-tomato-5.png?v=20261010_v26',
    gridImg: 'assets/tomatoes/grid-tomato-5.png?v=20261010_v26',
    miniImg: 'assets/tomatoes/mini-tomato-5.png?v=20261010_v26',
  },
  completed: {
    name: 'Satin Silver Metallic',
    hex: '#C2C7CE',
    heroImg: 'assets/tomatoes/hero-tomato-silver.png?v=20261010_v26',
    gridImg: 'assets/tomatoes/grid-tomato-silver.png?v=20261010_v26',
    miniImg: 'assets/tomatoes/mini-tomato-silver.png?v=20261010_v26',
  },
  unassigned: {
    name: 'Matte Neutral Grey',
    hex: '#8E8D8A',
    heroImg: 'assets/tomatoes/hero-tomato-grey.png?v=20261010_v26',
    gridImg: 'assets/tomatoes/grid-tomato-grey.png?v=20261010_v26',
    miniImg: 'assets/tomatoes/mini-tomato-grey.png?v=20261010_v26',
  },
};

/**
 * Exact sub-pixel equatorial seam curve y(x) measured directly from the dark seam groove
 * in 02-hero-timer.png (in local tomato coordinates where center x = 250.5, R_eq = 215.5).
 * Follows the exact smooth analytical polynomial fit to the dark center opening
 * without hooking or curving backwards at the left/right edges.
 */
export function getTomatoSeamY(x) {
  const cx = 250.5;
  const rx = 215.5;
  const u = Math.max(-1.0, Math.min(1.0, (x - cx) / rx));
  return 258.8 + 0.5 * u - 18.2 * (u * u) - 15.2 * (u * u * u * u);
}

/**
 * Tangent slope dy/dx of the equatorial seam at horizontal coordinate x.
 */
export function getTomatoSeamSlope(x) {
  const eps = 1.5;
  return (getTomatoSeamY(x + eps) - getTomatoSeamY(x - eps)) / (2.0 * eps);
}

/**
 * Top-half twist (v57): the top half is a real 3D object (see tomatoTop3D.js) that turns a full
 * 360° with the dial, lit with the studio light captured from each sprite (matcap). The sprite's
 * own top half is erased (clean plate) and the 3D top is drawn in its place; the bottom half,
 * pointer, seam groove and backdrop stay the photo.
 */
const TOP = TOP_GEOMETRY;
// Surface speed matched to the number band at the front (band uses asin(0.978u) * 1.118, 3 deg/min)
const TOP_DEG_PER_MINUTE = 3.0 / (0.978 * 1.118);
const MATCAP_SIZE = 96;

function smoothstep01(t) {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

function twistSeamScreenY(spriteX) {
  // getTomatoSeamY works in band-local coords (sprite = local + (80, 40))
  return getTomatoSeamY(spriteX - 80) + 40;
}

export class HeroTomato3DView {
  constructor(container) {
    this.container = container;
    this.currentAngleDegrees = 900.0; // 150 minutes (02:30)
    this.quadrantIndex = 0;
    this.isAssigned = true;
    this.isCompleted = false;
    this.silverBlend = 0.0;
    this.targetSilverBlend = 0.0;
    this._silverAnimFrame = null;
    this._silverAnimLastTs = 0;
    this.images = new Map();

    // Expanded 700 x 600 coordinate space (crop x=54..754, y=536..1136) so the entire soft shadow fits with zero border line
    this.baseW = 700;
    this.baseH = 600;
    this.offsetX = 80; // 134 - 54
    this.offsetY = 40; // 576 - 536

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.baseW * 2;
    this.canvas.height = this.baseH * 2;
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.objectFit = 'contain';
    this.ctx = this.canvas.getContext('2d');

    this.container.innerHTML = '';
    this.container.appendChild(this.canvas);

    // Build the 2x Retina 2D Odometer Texture Ribbon (0..180 min) and the 3D Tomato Equatorial Surface Mesh
    this._buildOdometerTextureStrip();
    this._buildTomato3DMesh();
    this._preloadImages();
  }

  /**
   * Renders the unrolled flat 2D Odometer Texture Ribbon (0..180 minutes + ticks) at 2x Retina resolution
   * so it can be UV-projected onto the 3D curved surface mesh of the tomato.
   */
  _buildOdometerTextureStrip() {
    this.pxPerMin = 24; // 24 Retina pixels per minute on the unrolled cylinder ribbon
    this.stripW = 190 * this.pxPerMin; // Covers -5..185 minutes
    this.stripH = 160; // 2x Retina height of the equatorial odometer band

    const stripCanvas = document.createElement('canvas');
    stripCanvas.width = this.stripW;
    stripCanvas.height = this.stripH;
    const sctx = stripCanvas.getContext('2d');

    sctx.clearRect(0, 0, this.stripW, this.stripH);
    sctx.strokeStyle = '#FFFFFF';
    sctx.fillStyle = '#FFFFFF';
    sctx.lineCap = 'round';
    sctx.textAlign = 'center';
    sctx.textBaseline = 'bottom';
    sctx.font = '500 41px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif';

    const yBot = this.stripH - 10; // 5.0px above the equatorial seam in 1x coordinates

    for (let m = 0; m <= 180; m++) {
      const ux = (m + 5) * this.pxPerMin;
      const isMajor10 = m % 10 === 0;
      const isMedium5 = m % 5 === 0 && !isMajor10;

      const tickLen = isMajor10 ? 35.0 : isMedium5 ? 26.0 : 21.0;
      sctx.lineWidth = isMajor10 ? 3.7 : isMedium5 ? 2.9 : 2.4;

      sctx.beginPath();
      sctx.moveTo(ux, yBot);
      sctx.lineTo(ux, yBot - tickLen);
      sctx.stroke();

      if (isMajor10) {
        sctx.fillText(String(m), ux, this.stripH - 53);
      }
    }

    const imgData = sctx.getImageData(0, 0, this.stripW, this.stripH).data;
    this.stripAlpha = new Uint8Array(this.stripW * this.stripH);
    for (let i = 0; i < this.stripAlpha.length; i++) {
      this.stripAlpha[i] = imgData[i * 4 + 3];
    }
  }

  /**
   * Builds the 3D Surface Mesh of the Tomato's Equatorial Band (x: 35..467, y: 140..266 in local 1x coords).
   * Each vertex/pixel on the 3D mesh stores its 3D cylindrical azimuth angle thetaDeg, meridian height sv,
   * horizontal perspective derivative du_dsx, and 3D directional studio key-light shading (pr, pg, pb).
   */
  _buildTomato3DMesh() {
    this.bandX0 = 32;
    this.bandY0 = 140;
    this.bandW1x = 438;
    this.bandH1x = 126;
    this.bandW = this.bandW1x * 2; // 876 Retina px
    this.bandH = this.bandH1x * 2; // 252 Retina px

    this.bandCanvas = document.createElement('canvas');
    this.bandCanvas.width = this.bandW;
    this.bandCanvas.height = this.bandH;
    this.bandCtx = this.bandCanvas.getContext('2d');
    this.bandImageData = this.bandCtx.createImageData(this.bandW, this.bandH);

    const cx = 250.5;
    const R_eq = 215.5;
    const degPerMin = 3.0;

    const pixelIndices = [];
    const thetaDegs = [];
    const svs = [];
    const duDsxs = [];
    const prs = [];
    const pgs = [];
    const pbs = [];
    const silverPRs = [];
    const silverPGs = [];
    const silverPBs = [];
    const baseAlphas = [];

    for (let by = 0; by < this.bandH; by++) {
      const ly = this.bandY0 + by * 0.5;
      for (let bx = 0; bx < this.bandW; bx++) {
        const lx = this.bandX0 + bx * 0.5;
        const u = (lx - cx) / R_eq;
        const absU = Math.abs(u);
        if (absU >= 0.996) continue;

        const seamY = getTomatoSeamY(lx);
        const vRaw = seamY - ly;
        if (vRaw < 0 || vRaw >= 78.0) continue;

        // Perspective-camera horizon mapping so +-25 min (+-75 deg, including full 2-digit numbers up to +-78.5 deg)
        // sits completely inside the full-opacity tomato surface (absU <= 0.968) with zero cut-off digits
        const sinPersp = 0.978 * u;
        const cosPersp = Math.sqrt(Math.max(0.055, 1.0 - sinPersp * sinPersp));
        const thetaBaseDeg = ((Math.asin(sinPersp) * 180.0) / Math.PI) * 1.118;

        // Smoothly relax the sharp u^4 cut-lip term as height rises from the seam ticks into the upper-dome numbers
        const tLat = Math.max(0.0, Math.min(1.0, (vRaw - 15.0) / 28.0));
        const sLat = tLat * tLat * (3.0 - 2.0 * tLat);
        const u2 = u * u;
        const u4 = u2 * u2;
        const yLatBase = seamY + 8.6 * sLat * u4;

        const v = (yLatBase - ly) / (0.90 + 0.10 * cosPersp);
        if (v < 0 || v >= 78.5) continue;

        const sv = (this.stripH - 1) - v * 2.0;
        if (sv < 0 || sv >= this.stripH - 1) continue;

        // Bounded inward meridian tilt outside asin() so digits at the visual curve edge never shear or clip at the top
        const meridianTiltDeg = -0.62 * u * ((v - 5.0) / 35.0);
        const thetaDeg = thetaBaseDeg + meridianTiltDeg;

        // Horizontal UV derivative du/dbx for 4x supersampled anti-aliasing on perspective-foreshortened side numbers
        const dThetaDu = ((0.978 * 1.118 * 180.0) / Math.PI) / cosPersp;
        const duDsx = ((dThetaDu / R_eq) / degPerMin) * this.pxPerMin * 0.5;

        // 3D studio key-light shading on the tomato surface normal N = (sinPersp, 0.18, cosPersp)
        const light = Math.max(0.48, Math.min(1.02, 0.86 - 0.34 * sinPersp + 0.08 * cosPersp));
        const pr = Math.round(246 * light);
        const pg = Math.round(202 * light);
        const pb = Math.round(198 * light);

        // On the Satin Silver Metallic tomato, etched dark anthracite-charcoal markings provide crisp minimalistic contrast
        const sLight = Math.max(0.55, Math.min(1.0, 0.90 - 0.25 * sinPersp));
        const spr = Math.round(32 * sLight);
        const spg = Math.round(34 * sLight);
        const spb = Math.round(38 * sLight);

        const rimFade = absU > 0.962 ? (0.986 - absU) / (0.986 - 0.962) : 1.0;
        const baseAlpha = 0.88 * Math.max(0.0, Math.min(1.0, rimFade));

        pixelIndices.push((by * this.bandW + bx) * 4);
        thetaDegs.push(thetaDeg);
        svs.push(sv);
        duDsxs.push(duDsx);
        prs.push(pr);
        pgs.push(pg);
        pbs.push(pb);
        silverPRs.push(spr);
        silverPGs.push(spg);
        silverPBs.push(spb);
        baseAlphas.push(baseAlpha);
      }
    }

    this.meshCount = pixelIndices.length;
    this.meshPixelIdx = new Int32Array(pixelIndices);
    this.meshThetaDeg = new Float32Array(thetaDegs);
    this.meshSV = new Float32Array(svs);
    this.meshDuDsx = new Float32Array(duDsxs);
    this.meshPR = new Uint8Array(prs);
    this.meshPG = new Uint8Array(pgs);
    this.meshPB = new Uint8Array(pbs);
    this.meshSilverPR = new Uint8Array(silverPRs);
    this.meshSilverPG = new Uint8Array(silverPGs);
    this.meshSilverPB = new Uint8Array(silverPBs);
    this.meshBaseAlpha = new Float32Array(baseAlphas);
  }

  _preloadImages() {
    const keys = [0, 1, 2, 3, 4, 5, 'completed', 'unassigned'];
    keys.forEach((k) => {
      const entry = HEIRLOOM_PALETTE[k];
      if (!entry) return;
      const img = new Image();
      img.src = entry.heroImg;
      img.onload = () => {
        this.images.set(k, img);
        this.render();
        if (this.images.size === keys.length) this._warmUpTwist();
      };
    });
  }

  /** Prepares the 3D top in idle moments, so the first look at the timer page doesn't stutter. */
  _warmUpTwist() {
    if (this._twWarmStarted) return;
    this._twWarmStarted = true;
    const idle =
      typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'
        ? (fn) => window.requestIdleCallback(fn, { timeout: 2000 })
        : (fn) => setTimeout(fn, 300);
    const steps = [
      () => this._getTop3D(),
      () => this._twistGeometry(),
      () => this._topMasks(),
      () => this._topReady(this.isAssigned ? (this.quadrantIndex ?? 0) : 'unassigned'),
      () => this._topReady('unassigned'),
    ];
    const runNext = () => {
      const step = steps.shift();
      if (!step) return;
      try {
        step();
      } catch (_) {}
      if (steps.length) idle(runNext);
    };
    setTimeout(() => idle(runNext), 6000);
  }

  updateOdometer(angleDegrees, quadrantIndex = 0, isAssigned = true, isCompleted = false) {
    this.currentAngleDegrees = angleDegrees;
    this.quadrantIndex = quadrantIndex;
    this.isAssigned = isAssigned;
    this.isCompleted = Boolean(isCompleted);
    this.targetSilverBlend = this.isCompleted ? 1.0 : 0.0;

    if (Math.abs(this.targetSilverBlend - this.silverBlend) > 0.004) {
      this._startSilverTransition();
    } else {
      this.silverBlend = this.targetSilverBlend;
      this.render();
    }
  }

  _startSilverTransition() {
    if (this._silverAnimFrame) {
      this.render();
      return;
    }
    this._silverAnimLastTs = performance.now();
    const step = (now) => {
      const dt = Math.min(0.06, Math.max(0.008, (now - this._silverAnimLastTs) / 1000.0));
      this._silverAnimLastTs = now;
      const speed = 2.05; // ~490ms full smooth transition
      if (this.silverBlend < this.targetSilverBlend) {
        this.silverBlend = Math.min(this.targetSilverBlend, this.silverBlend + dt * speed);
      } else {
        this.silverBlend = Math.max(this.targetSilverBlend, this.silverBlend - dt * speed);
      }
      this.render();
      if (Math.abs(this.targetSilverBlend - this.silverBlend) > 0.004) {
        this._silverAnimFrame = requestAnimationFrame(step);
      } else {
        this.silverBlend = this.targetSilverBlend;
        this._silverAnimFrame = null;
        this.render();
      }
    };
    this._silverAnimFrame = requestAnimationFrame(step);
  }

  resize() {
    this.render();
  }

  /**
   * Which body point of the upper half every pixel of the working box shows (same for all colours).
   * Marches the superellipse cross-section of each pixel column and keeps the camera-facing arc.
   */
  _twistGeometry() {
    if (this._twGeo) return this._twGeo;
    const T = TOP;
    const cosE = Math.sqrt(1 - T.sinE * T.sinE);
    const W = T.box.x1 - T.box.x0;
    const H = T.box.y1 - T.box.y0;
    const N = W * H;

    // Profile from the seam (r = a, Y = 0) to the pole (r = 0, Y = b), ~0.35 px arc steps
    const pr = [T.a];
    const py = [0];
    const fine = 6000;
    let lastR = T.a;
    let lastY = 0;
    let acc = 0;
    for (let i = 1; i <= fine; i++) {
      const t = (i / fine) * (Math.PI / 2);
      const r = T.a * Math.pow(Math.max(0, Math.cos(t)), 2 / T.p);
      const yv = T.b * Math.pow(Math.sin(t), 2 / T.p);
      acc += Math.hypot(r - lastR, yv - lastY);
      lastR = r;
      lastY = yv;
      if (acc >= 0.35 || i === fine) {
        pr.push(r);
        py.push(yv);
        acc = 0;
      }
    }
    const n = pr.length;

    const cover = new Uint8Array(N);
    const gX = new Float32Array(N);
    const gZ = new Float32Array(N);
    const gC = new Float32Array(N);
    const arcY = new Float32Array(2 * n + 1);
    const arcZ = new Float32Array(2 * n + 1);
    const arcS = new Float32Array(2 * n + 1);
    for (let bx = 0; bx < W; bx++) {
      const X = T.box.x0 + bx - T.cx;
      const ax = Math.abs(X);
      if (ax >= T.a) continue;
      let k = 0;
      while (k < n && pr[k] >= ax) k++;
      if (k === 0) continue;
      let apexY = py[k - 1];
      if (k < n) {
        const f = (pr[k - 1] - ax) / Math.max(1e-6, pr[k - 1] - pr[k]);
        apexY = py[k - 1] + f * (py[k] - py[k - 1]);
      }
      // Closed cross-section: far side (seam -> apex), apex, near side (apex -> seam)
      let m = 0;
      for (let i = 0; i < k; i++) {
        arcY[m] = py[i];
        arcZ[m] = -Math.sqrt(Math.max(0, pr[i] * pr[i] - ax * ax));
        m++;
      }
      arcY[m] = apexY;
      arcZ[m] = 0;
      m++;
      for (let i = k - 1; i >= 0; i--) {
        arcY[m] = py[i];
        arcZ[m] = Math.sqrt(Math.max(0, pr[i] * pr[i] - ax * ax));
        m++;
      }
      let kMin = 0;
      let sMin = Infinity;
      for (let i = 0; i < m; i++) {
        const s = T.ys0 - arcY[i] * cosE + arcZ[i] * T.sinE;
        arcS[i] = s;
        if (s < sMin) {
          sMin = s;
          kMin = i;
        }
      }
      // Visible arc: top outline (sMin) -> over the front -> down to the seam
      let j = kMin;
      const sEnd = arcS[m - 1];
      for (let yRow = Math.ceil(sMin); yRow <= Math.floor(sEnd); yRow++) {
        while (j < m - 2 && arcS[j + 1] < yRow) j++;
        const s0 = arcS[j];
        const s1 = arcS[j + 1];
        let f = s1 > s0 ? (yRow - s0) / (s1 - s0) : 0;
        f = f < 0 ? 0 : f > 1 ? 1 : f;
        const by = yRow - T.box.y0;
        if (by < 0 || by >= H) continue;
        const id = by * W + bx;
        cover[id] = 1;
        gX[id] = X;
        gZ[id] = arcZ[j] + f * (arcZ[j + 1] - arcZ[j]);
        gC[id] = T.ys0 - (arcY[j] + f * (arcY[j + 1] - arcY[j])) * cosE;
      }
    }
    this._twGeo = { W, H, N, cover, gX, gZ, gC };
    return this._twGeo;
  }

  /** Reads sprite pixels of the working box (null if the browser refuses). */
  _twistReadSprite(key) {
    const img = this.images.get(key);
    if (!img || !img.complete || !img.naturalWidth) return null;
    const B = TOP.box;
    try {
      const cnv = document.createElement('canvas');
      cnv.width = B.x1 - B.x0;
      cnv.height = B.y1 - B.y0;
      const cctx = cnv.getContext('2d', { willReadFrequently: true });
      cctx.drawImage(img, -B.x0, -B.y0);
      return cctx.getImageData(0, 0, cnv.width, cnv.height).data;
    } catch (_) {
      return null;
    }
  }

  _getTop3D() {
    if (this._top3D && this._top3D.gl && this._top3D.gl.isContextLost()) {
      this._top3D = undefined;
      this._cleanPlates = undefined;
    }
    if (this._top3D === undefined) this._top3D = TomatoTop3D.create();
    return this._top3D;
  }

  /**
   * Shared by all colours (same sculpt): tomato-vs-backdrop mask of the working box (read from a
   * deep-coloured sprite, which stands out clearly from the backdrop), distance to the outline,
   * the seam line per column, and the bottom-bowl interior mask/distance for unified texture.
   */
  _topMasks() {
    if (this._twMasks !== undefined) return this._twMasks;
    const refImg = this.images.get(0);
    if (!refImg || !refImg.complete || !refImg.naturalWidth) return null;
    const src = this._twistReadSprite(0);
    if (!src) {
      this._twMasks = false;
      return false;
    }
    const B = TOP.box;
    const W = B.x1 - B.x0;
    const H = B.y1 - B.y0;
    const N = W * H;
    const bgR = src[0];
    const bgG = src[1];
    const bgB = src[2];
    const seamY = new Float32Array(W);
    for (let bx = 0; bx < W; bx++) seamY[bx] = twistSeamScreenY(B.x0 + bx);
    const solid = new Uint8Array(N);
    for (let id = 0; id < N; id++) {
      const i = id * 4;
      const d = Math.abs(src[i] - bgR) + Math.abs(src[i + 1] - bgG) + Math.abs(src[i + 2] - bgB);
      if (d > 30) solid[id] = 1;
    }
    const chamfer = (mask, w, h) => {
      const n = w * h;
      const out = new Float32Array(n);
      for (let id = 0; id < n; id++) out[id] = mask[id] ? 1e6 : 0;
      for (let by = 0; by < h; by++) {
        for (let bx = 0; bx < w; bx++) {
          const id = by * w + bx;
          let d = out[id];
          if (d === 0) continue;
          if (bx > 0) d = Math.min(d, out[id - 1] + 1);
          if (by > 0) {
            d = Math.min(d, out[id - w] + 1);
            if (bx > 0) d = Math.min(d, out[id - w - 1] + 1.4142);
            if (bx < w - 1) d = Math.min(d, out[id - w + 1] + 1.4142);
          }
          out[id] = d;
        }
      }
      for (let by = h - 1; by >= 0; by--) {
        for (let bx = w - 1; bx >= 0; bx--) {
          const id = by * w + bx;
          let d = out[id];
          if (d === 0) continue;
          if (bx < w - 1) d = Math.min(d, out[id + 1] + 1);
          if (by < h - 1) {
            d = Math.min(d, out[id + w] + 1);
            if (bx < w - 1) d = Math.min(d, out[id + w + 1] + 1.4142);
            if (bx > 0) d = Math.min(d, out[id + w - 1] + 1.4142);
          }
          out[id] = d;
        }
      }
      return out;
    };
    const dist = chamfer(solid, W, H);

    // Bottom bowl mask (x: 108..556, y: 246..444 in 1x sprite units) read from Deep Crimson (key 0),
    // where red chroma (R - G >= 24) cleanly separates the tomato body from the cream backdrop and
    // the neutral grey floor shadow (R - G <= 3), while keeping the seam groove and white pointer out.
    const botBox = { x0: B.x0, y0: 246, x1: B.x1, y1: 444 };
    const botH = botBox.y1 - botBox.y0;
    const botN = W * botH;
    const botSolid = new Uint8Array(botN);
    const seamBandSolid = new Uint8Array(botN);
    try {
      const bcnv = document.createElement('canvas');
      bcnv.width = W;
      bcnv.height = botH;
      const bctx = bcnv.getContext('2d', { willReadFrequently: true });
      bctx.drawImage(refImg, -botBox.x0, -botBox.y0);
      const bsrc = bctx.getImageData(0, 0, W, botH).data;
      for (let by = 0; by < botH; by++) {
        const sy = botBox.y0 + by;
        for (let bx = 0; bx < W; bx++) {
          const sx = botBox.x0 + bx;
          const i = (by * W + bx) * 4;
          if (bsrc[i] - bsrc[i + 1] < 24) continue;
          // Seam blend band just above the groove (where 3D top alpha ramps from 0..1)
          if (sy >= seamY[bx] - 15.0 && sy <= seamY[bx] - 2.0) {
            seamBandSolid[by * W + bx] = 1;
          }
          if (sy < seamY[bx] + 2.2) continue;
          // Exclude the white pointer triangle (x: 321..339, y: 317..337) and a 1.5px collar
          if (sx >= 320 && sx <= 340 && sy >= 316 && sy <= 338) continue;
          botSolid[by * W + bx] = 1;
        }
      }
    } catch (_) {}
    const botDist = chamfer(botSolid, W, botH);
    const seamBandDist = chamfer(seamBandSolid, W, botH);

    // Fast 256x256 tileable smooth value-noise table so the 2x Retina bottom bowl gets the exact
    // same multi-scale matte heirloom skin texture (pores + subtle organic mottle + micro-bump)
    // as the WebGL2 3D upper half in under 3ms.
    const NS = 256;
    const rawNoise = new Float32Array(NS * NS);
    for (let y = 0; y < NS; y++) {
      for (let x = 0; x < NS; x++) {
        const h = Math.sin(x * 127.1 + y * 311.7 + 74.7) * 43758.5453;
        rawNoise[y * NS + x] = h - Math.floor(h);
      }
    }
    const sampleTile = (fx, fy) => {
      const ix = Math.floor(fx);
      const iy = Math.floor(fy);
      const tx = fx - ix;
      const ty = fy - iy;
      const ux = tx * tx * (3 - 2 * tx);
      const uy = ty * ty * (3 - 2 * ty);
      const x0 = ix & 255;
      const x1 = (ix + 1) & 255;
      const y0 = (iy & 255) * NS;
      const y1 = ((iy + 1) & 255) * NS;
      const a = rawNoise[y0 + x0] + (rawNoise[y0 + x1] - rawNoise[y0 + x0]) * ux;
      const b = rawNoise[y1 + x0] + (rawNoise[y1 + x1] - rawNoise[y1 + x0]) * ux;
      return a + (b - a) * uy;
    };

    this._twMasks = {
      W,
      H,
      N,
      solid,
      dist,
      seamY,
      botBox,
      botH,
      botSolid,
      botDist,
      seamBandDist,
      sampleTile,
    };
    return this._twMasks;
  }

  /**
   * Studio light of sprite `key` as a matcap: the colour of the bare dome for each surface
   * direction (view-space normal x/y), taken from the photo's smooth top half (leaves, stem,
   * outline and seam groove left out), median per bin. Directions the photo doesn't show (e.g.
   * leaf flanks tipped further down than any dome point) come from a smooth fit of the same light
   * (2nd-order spherical harmonics in linear light), so the whole matcap is plausible.
   */
  _buildMatcap(key) {
    const top = this._getTop3D();
    const M = this._topMasks();
    const src = this._twistReadSprite(key);
    if (!top || !M || !src) return null;
    const Gm = this._twistGeometry();
    const { W, H, N } = M;
    const B = TOP.box;
    const cosE = Math.sqrt(1 - TOP.sinE * TOP.sinE);

    // keep the photo's leaves (where the 3D leaves sit at dial 0), their shadows and the stem out
    const excl = new Uint8Array(N);
    const mark = (cx, cy, rad) => {
      const x0 = Math.max(0, Math.floor(cx - B.x0 - rad));
      const x1 = Math.min(W - 1, Math.ceil(cx - B.x0 + rad));
      const y0 = Math.max(0, Math.floor(cy - B.y0 - rad));
      const y1 = Math.min(H - 1, Math.ceil(cy - B.y0 + rad + 8));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dx = x + B.x0 - cx;
          const dy = y + B.y0 - cy;
          // round brush, stretched downward to cover the shadow under the leaf
          if (dx * dx + Math.pow(dy > 0 ? dy / 2.0 : dy, 2) <= rad * rad) excl[y * W + x] = 1;
        }
      }
    };
    top.footprintAtZero().forEach(([x, y]) => mark(x, y, 7));
    for (let y = 0; y < H; y++) {
      const sy = y + B.y0;
      for (let x = 0; x < W; x++) {
        const sx = x + B.x0;
        if (sx > 300 && sx < 364 && sy < 124) excl[y * W + x] = 1; // stem, collar and its crevice
      }
    }

    const size = MATCAP_SIZE;
    const bins = new Array(size * size);
    const toLin = (c) => {
      const v = c / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    const toSrgb = (v) => {
      const x = Math.max(0, v);
      return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
    };
    const shBasis = (x, y, z, out) => {
      out[0] = 1;
      out[1] = x;
      out[2] = y;
      out[3] = z;
      out[4] = x * y;
      out[5] = y * z;
      out[6] = x * z;
      out[7] = x * x - y * y;
      out[8] = 3 * z * z - 1;
      return out;
    };
    const ATA = new Float64Array(81);
    const ATb = [new Float64Array(9), new Float64Array(9), new Float64Array(9)];
    const basis = new Float64Array(9);
    let minLum = Infinity;
    let maxLum = 0;
    const { a, b, p } = TOP;
    for (let id = 0; id < N; id++) {
      if (!Gm.cover[id] || !M.solid[id] || excl[id] || M.dist[id] < 3) continue;
      const bx = id % W;
      const by = (id - bx) / W;
      if (M.seamY[bx] - (by + B.y0) < 8) continue;
      const X = Gm.gX[id];
      const Z = Gm.gZ[id];
      const Y = (TOP.ys0 - Gm.gC[id]) / cosE;
      const r = Math.hypot(X, Z);
      // the cap carries the photo's leaves, their shadows and the well (not in this smooth model);
      // its upward-facing light comes from the smooth fit instead
      if (r < 125) continue;
      // the far side near the top outline carries the photo's back leaves: not light either
      if (Z < -12) continue;
      let nr = Math.pow(Math.min(1, r / a), p - 1) / a;
      let ny = Math.pow(Math.max(0, Y / b), p - 1) / b;
      const l = Math.hypot(nr, ny) || 1;
      nr /= l;
      ny /= l;
      const wx = (nr * X) / r;
      const wz = (nr * Z) / r;
      const vx = wx;
      const vy = ny * cosE - wz * TOP.sinE;
      const vz = ny * TOP.sinE + wz * cosE;
      const u = Math.round(((vx + 1) / 2) * (size - 1));
      const v = Math.round(((vy + 1) / 2) * (size - 1));
      if (u < 0 || v < 0 || u >= size || v >= size) continue;
      const k = v * size + u;
      const i4 = id * 4;
      (bins[k] || (bins[k] = [])).push(i4);
      if ((bx + by) & 1) continue; // every other pixel is plenty for the fit
      shBasis(vx, vy, vz, basis);
      const lr = toLin(src[i4]);
      const lg = toLin(src[i4 + 1]);
      const lb = toLin(src[i4 + 2]);
      const lum = 0.3 * lr + 0.59 * lg + 0.11 * lb;
      if (lum < minLum) minLum = lum;
      if (lum > maxLum) maxLum = lum;
      for (let i = 0; i < 9; i++) {
        const bi = basis[i];
        ATb[0][i] += bi * lr;
        ATb[1][i] += bi * lg;
        ATb[2][i] += bi * lb;
        for (let j = 0; j < 9; j++) ATA[i * 9 + j] += bi * basis[j];
      }
    }
    // solve (ATA + ridge) c = ATb for each channel (Gaussian elimination, partial pivoting)
    let tr = 0;
    for (let i = 0; i < 9; i++) tr += ATA[i * 9 + i];
    const ridge = (tr / 9) * 2e-3;
    const solve = (rhs) => {
      const A = new Float64Array(ATA);
      const x = new Float64Array(rhs);
      for (let i = 0; i < 9; i++) A[i * 9 + i] += ridge;
      for (let c = 0; c < 9; c++) {
        let piv = c;
        for (let r = c + 1; r < 9; r++) if (Math.abs(A[r * 9 + c]) > Math.abs(A[piv * 9 + c])) piv = r;
        if (piv !== c) {
          for (let j = 0; j < 9; j++) {
            const t = A[c * 9 + j];
            A[c * 9 + j] = A[piv * 9 + j];
            A[piv * 9 + j] = t;
          }
          const t = x[c];
          x[c] = x[piv];
          x[piv] = t;
        }
        const d = A[c * 9 + c] || 1e-12;
        for (let r = c + 1; r < 9; r++) {
          const f = A[r * 9 + c] / d;
          if (!f) continue;
          for (let j = c; j < 9; j++) A[r * 9 + j] -= f * A[c * 9 + j];
          x[r] -= f * x[c];
        }
      }
      for (let c = 8; c >= 0; c--) {
        let sum = x[c];
        for (let j = c + 1; j < 9; j++) sum -= A[c * 9 + j] * x[j];
        x[c] = sum / (A[c * 9 + c] || 1e-12);
      }
      return x;
    };
    const coef = [solve(ATb[0]), solve(ATb[1]), solve(ATb[2])];
    const lumLo = Number.isFinite(minLum) ? minLum * 0.7 : 0;
    const lumHi = maxLum * 1.08;

    // The photo's dome carries small creases and lobes; read per direction they would print
    // stripes onto every surface facing that way (stem tip, leaf tops). So: smooth fit everywhere,
    // plus only the broad, low-frequency difference between the photo and the fit.
    const fitCol = new Float32Array(size * size * 3);
    const resid = new Float32Array(size * size * 3);
    const rw = new Float32Array(size * size);
    const med = (arr, c) => {
      const vals = arr.map((i) => src[i + c]).sort((x, y) => x - y);
      return vals[vals.length >> 1];
    };
    for (let v = 0; v < size; v++) {
      for (let u = 0; u < size; u++) {
        let x = (u / (size - 1)) * 2 - 1;
        let y = (v / (size - 1)) * 2 - 1;
        const rr = Math.hypot(x, y);
        if (rr > 0.999) {
          x *= 0.999 / rr;
          y *= 0.999 / rr;
        }
        // Only the upper half of the sphere has photo samples; for downward-tipped normals
        // (y < 0.14), evaluate the fit at the sampled rim and gently shade downward.
        const yEval = Math.max(0.14, y);
        let xEval = x;
        const rEval = Math.hypot(xEval, yEval);
        if (rEval > 0.999) xEval *= 0.999 / rEval;
        const zEval = Math.sqrt(Math.max(0, 1 - xEval * xEval - yEval * yEval));
        shBasis(xEval, yEval, zEval, basis);
        const underShade = y < 0.14 ? 1 - 0.18 * Math.min(1, (0.14 - y) / 0.85) : 1;
        const lin = [0, 0, 0];
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          for (let i = 0; i < 9; i++) sum += coef[c][i] * basis[i];
          lin[c] = Math.max(0, sum) * underShade;
        }
        // keep the extrapolated light within the photo's own range (no blow-outs, no black)
        const lum = 0.3 * lin[0] + 0.59 * lin[1] + 0.11 * lin[2];
        const k = lum > 1e-6 ? Math.min(lumHi, Math.max(lumLo * underShade, lum)) / lum : 1;
        const t = v * size + u;
        for (let c = 0; c < 3; c++) fitCol[t * 3 + c] = toSrgb(lin[c] * k);
        const arr = bins[t];
        if (arr && arr.length >= 2) {
          const w = Math.min(1, arr.length / 6);
          rw[t] = w;
          for (let c = 0; c < 3; c++) resid[t * 3 + c] = (med(arr, c) - fitCol[t * 3 + c]) * w;
        }
      }
    }
    // wide separable Gaussian (sigma ~7 texels) of the weighted residual and of the weights
    const sigma = 7;
    const R = Math.ceil(sigma * 2.5);
    const kern = [];
    for (let i = -R; i <= R; i++) kern.push(Math.exp(-(i * i) / (2 * sigma * sigma)));
    const blur = (arr, ch) => {
      const tmp = new Float32Array(arr.length);
      const out = new Float32Array(arr.length);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          for (let c = 0; c < ch; c++) {
            let acc = 0;
            for (let i = -R; i <= R; i++) {
              const xx = x + i;
              if (xx < 0 || xx >= size) continue;
              acc += arr[(y * size + xx) * ch + c] * kern[i + R];
            }
            tmp[(y * size + x) * ch + c] = acc;
          }
        }
      }
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          for (let c = 0; c < ch; c++) {
            let acc = 0;
            for (let i = -R; i <= R; i++) {
              const yy = y + i;
              if (yy < 0 || yy >= size) continue;
              acc += tmp[(yy * size + x) * ch + c] * kern[i + R];
            }
            out[(y * size + x) * ch + c] = acc;
          }
        }
      }
      return out;
    };
    const residB = blur(resid, 3);
    const wB = blur(rw, 1);
    let wMax = 0;
    for (let t = 0; t < size * size; t++) wMax = Math.max(wMax, wB[t]);
    const cur = new Float32Array(size * size * 3);
    for (let t = 0; t < size * size; t++) {
      const cover = wMax > 0 ? Math.min(1, wB[t] / (0.35 * wMax)) : 0; // fades out away from photo data
      for (let c = 0; c < 3; c++) {
        const corr = wB[t] > 1e-6 ? residB[t * 3 + c] / wB[t] : 0;
        cur[t * 3 + c] = fitCol[t * 3 + c] + corr * cover;
      }
    }
    const rgba = new Uint8Array(size * size * 4);
    for (let k = 0; k < size * size; k++) {
      rgba[k * 4] = Math.round(Math.max(0, Math.min(255, cur[k * 3])));
      rgba[k * 4 + 1] = Math.round(Math.max(0, Math.min(255, cur[k * 3 + 1])));
      rgba[k * 4 + 2] = Math.round(Math.max(0, Math.min(255, cur[k * 3 + 2])));
      rgba[k * 4 + 3] = 255;
    }
    return { rgba, size };
  }

  /**
   * The sprite at 2x Retina with its top half (incl. leaves and stem) replaced by the backdrop,
   * and its bottom tomato bowl smoothed of blurry 1x photo blotches and surfaced with the same
   * 2x Retina matte heirloom skin texture (pores + organic mottle + micro-bump) as the 3D top half.
   */
  _buildCleanPlate(key) {
    const img = this.images.get(key);
    const M = this._topMasks();
    if (!img || !M) return null;
    const B = TOP.box;
    const { W, H, solid, seamY, botBox, botH, botDist, seamBandDist, sampleTile } = M;
    const c1x = document.createElement('canvas');
    c1x.width = this.baseW;
    c1x.height = this.baseH;
    const cctx = c1x.getContext('2d', { willReadFrequently: true });
    cctx.drawImage(img, 0, 0, this.baseW, this.baseH);
    let data;
    try {
      data = cctx.getImageData(B.x0, B.y0, W, H);
    } catch (_) {
      return null;
    }
    const px = data.data;
    // erase mask: tomato above the seam blend zone, grown by 2 px to drop the outline's soft edge
    const erase = new Uint8Array(W * H);
    for (let by = 0; by < H; by++) {
      for (let bx = 0; bx < W; bx++) {
        if (B.y0 + by >= seamY[bx] - 12) continue;
        let hit = false;
        for (let dy = -2; dy <= 2 && !hit; dy++) {
          for (let dx = -2; dx <= 2 && !hit; dx++) {
            const x = bx + dx;
            const y = by + dy;
            if (x >= 0 && y >= 0 && x < W && y < H && solid[y * W + x]) hit = true;
          }
        }
        if (hit) erase[by * W + bx] = 1;
      }
    }
    for (let by = 0; by < H; by++) {
      let bx = 0;
      while (bx < W) {
        if (!erase[by * W + bx]) {
          bx++;
          continue;
        }
        const start = bx;
        while (bx < W && erase[by * W + bx]) bx++;
        const end = bx - 1;
        const li = (by * W + Math.max(0, start - 2)) * 4;
        const ri = (by * W + Math.min(W - 1, end + 2)) * 4;
        const span = Math.max(1, end - start + 2);
        for (let x = start; x <= end; x++) {
          const t = (x - start + 1) / span;
          const o = (by * W + x) * 4;
          px[o] = px[li] * (1 - t) + px[ri] * t;
          px[o + 1] = px[li + 1] * (1 - t) + px[ri + 1] * t;
          px[o + 2] = px[li + 2] * (1 - t) + px[ri + 2] * t;
        }
      }
    }
    cctx.putImageData(data, B.x0, B.y0);

    // Smooth out the blurry 1x blotches on the bottom half (leaving seam groove, pointer & rim untouched)
    let botData;
    try {
      botData = cctx.getImageData(botBox.x0, botBox.y0, W, botH);
    } catch (_) {
      botData = null;
    }
    if (botData && botDist) {
      const bpx = botData.data;
      const botN = W * botH;
      const wArr = new Float32Array(botN);
      const rW = new Float32Array(botN);
      const gW = new Float32Array(botN);
      const bW = new Float32Array(botN);
      for (let id = 0; id < botN; id++) {
        const w = smoothstep01((botDist[id] - 1.2) / 2.2);
        if (w <= 0) continue;
        const i4 = id * 4;
        wArr[id] = w;
        rW[id] = bpx[i4] * w;
        gW[id] = bpx[i4 + 1] * w;
        bW[id] = bpx[i4 + 2] * w;
      }
      const sigma = 20;
      const R = 40;
      const kern = new Float32Array(2 * R + 1);
      for (let i = -R; i <= R; i++) kern[i + R] = Math.exp(-(i * i) / (2 * sigma * sigma));
      const blur2D = (arr) => {
        const tmp = new Float32Array(botN);
        const out = new Float32Array(botN);
        for (let y = 0; y < botH; y++) {
          const row = y * W;
          for (let x = 0; x < W; x++) {
            let acc = 0;
            const i0 = Math.max(-R, -x);
            const i1 = Math.min(R, W - 1 - x);
            for (let i = i0; i <= i1; i++) acc += arr[row + x + i] * kern[i + R];
            tmp[row + x] = acc;
          }
        }
        for (let y = 0; y < botH; y++) {
          const row = y * W;
          const j0 = Math.max(-R, -y);
          const j1 = Math.min(R, botH - 1 - y);
          for (let x = 0; x < W; x++) {
            let acc = 0;
            for (let j = j0; j <= j1; j++) acc += tmp[(y + j) * W + x] * kern[j + R];
            out[row + x] = acc;
          }
        }
        return out;
      };
      const wB = blur2D(wArr);
      const rB = blur2D(rW);
      const gB = blur2D(gW);
      const bB = blur2D(bW);
      // Blend 96% smooth studio lighting + 4% broad variation so all blurry 1x blotches vanish
      for (let id = 0; id < botN; id++) {
        const wb = wB[id];
        if (wb <= 1e-5) continue;
        const blend = smoothstep01((botDist[id] - 0.5) / 2.2) * 0.96;
        if (blend <= 0) continue;
        const i4 = id * 4;
        const sr = rB[id] / wb;
        const sg = gB[id] / wb;
        const sb = bB[id] / wb;
        bpx[i4] = Math.round(bpx[i4] * (1 - blend) + sr * blend);
        bpx[i4 + 1] = Math.round(bpx[i4 + 1] * (1 - blend) + sg * blend);
        bpx[i4 + 2] = Math.round(bpx[i4 + 2] * (1 - blend) + sb * blend);
      }
      cctx.putImageData(botData, botBox.x0, botBox.y0);
    }

    // Build the final Clean Plate at 2x Retina resolution (1400x1200) and apply the unified
    // 2x Retina matte heirloom skin texture (matching TomatoTop3D's uGrain & uMottle 1:1).
    const plate2x = document.createElement('canvas');
    plate2x.width = this.baseW * 2;
    plate2x.height = this.baseH * 2;
    const pctx = plate2x.getContext('2d', { willReadFrequently: true });
    pctx.imageSmoothingEnabled = true;
    pctx.imageSmoothingQuality = 'high';
    pctx.drawImage(c1x, 0, 0, plate2x.width, plate2x.height);

    if (botDist && sampleTile) {
      const x0_2 = botBox.x0 * 2;
      const y0_2 = botBox.y0 * 2;
      const W2 = W * 2;
      const H2 = botH * 2;
      try {
        const b2Data = pctx.getImageData(x0_2, y0_2, W2, H2);
        const px2 = b2Data.data;
        const src2 = new Uint8ClampedArray(px2);
        const grainAmt = key === 'completed' ? 0.004 : 0.056;
        const mottleAmt = key === 'completed' ? 0.006 : 0.034;

        for (let by2 = 0; by2 < H2; by2++) {
          const by1 = by2 * 0.5;
          const iy = Math.min(botH - 1, by2 >> 1);
          const sy = botBox.y0 + by1;
          const row2 = by2 * W2;
          for (let bx2 = 0; bx2 < W2; bx2++) {
            const ix = Math.min(W - 1, bx2 >> 1);
            const dBot = botDist[iy * W + ix];
            const dSeam = seamBandDist ? seamBandDist[iy * W + ix] : 0;
            const d = Math.max(dBot, dSeam);
            if (d <= 0.4) continue;
            const wTex = smoothstep01((d - 0.4) / 2.2);
            if (wTex <= 0) continue;

            const bx1 = bx2 * 0.5;
            const sx = botBox.x0 + bx1;
            const X = sx - TOP.cx;
            const Y = sy - seamY[ix];
            // 3D lower-bowl surface coordinates so skin texture foreshortens naturally at the rim
            const Z = Math.sqrt(Math.max(25.0, TOP.a * TOP.a - X * X - Y * Y * 1.35));
            const u3 = X + Z * 0.42;
            const v3 = Y * 1.08 + Z * 0.36;

            // Fine skin pore noise (exact same frequencies 1.25 and 2.8 as TomatoTop3D)
            const fine0 =
              sampleTile(u3 * 1.25, v3 * 1.25) * 0.62 +
              sampleTile(u3 * 2.8 + 37.2, v3 * 2.8 + 19.4) * 0.38 -
              0.5;
            const fineX =
              sampleTile((u3 + 0.6) * 1.25, v3 * 1.25) * 0.62 +
              sampleTile((u3 + 0.6) * 2.8 + 37.2, v3 * 2.8 + 19.4) * 0.38 -
              0.5;
            const fineY =
              sampleTile(u3 * 1.25, (v3 + 0.6) * 1.25) * 0.62 +
              sampleTile(u3 * 2.8 + 37.2, (v3 + 0.6) * 2.8 + 19.4) * 0.38 -
              0.5;

            // Medium organic skin mottle (exact same frequencies 0.055 and 0.14 as TomatoTop3D)
            const mottle =
              sampleTile(u3 * 0.055 + 11.3, v3 * 0.055 + 53.1) * 0.58 +
              sampleTile(u3 * 0.14 + 83.7, v3 * 0.14 + 29.8) * 0.42 -
              0.5;

            // Micro-normal bump shifts lookup slightly across the studio light gradient
            const gx = (fineX - fine0) * (grainAmt * 28.0) * wTex;
            const gy = (fineY - fine0) * (grainAmt * 28.0) * wTex;
            const sx2 = Math.max(0, Math.min(W2 - 1, Math.round(bx2 + gx)));
            const sy2 = Math.max(0, Math.min(H2 - 1, Math.round(by2 + gy)));
            const sIdx = (sy2 * W2 + sx2) * 4;

            // Exact same * 2.0 contrast modulation as TomatoTop3D's fragment shader
            const factor =
              (1.0 + grainAmt * fine0 * 2.0 * wTex) *
              (1.0 + mottleAmt * mottle * 2.0 * wTex);
            const oIdx = (row2 + bx2) * 4;
            px2[oIdx] = Math.max(0, Math.min(255, Math.round(src2[sIdx] * factor)));
            px2[oIdx + 1] = Math.max(0, Math.min(255, Math.round(src2[sIdx + 1] * factor)));
            px2[oIdx + 2] = Math.max(0, Math.min(255, Math.round(src2[sIdx + 2] * factor)));
          }
        }
        pctx.putImageData(b2Data, x0_2, y0_2);
      } catch (_) {}
    }

    return plate2x;
  }

  /** True when the 3D top can draw colour `key` (builds its light + clean plate on first use). */
  _topReady(key) {
    const top = this._getTop3D();
    if (!top) return false;
    if (!this._cleanPlates) this._cleanPlates = new Map();
    if (top.hasMatcap(key) && this._cleanPlates.get(key)) return true;
    if (!this.images.get(key)) return false;
    const mc = this._buildMatcap(key);
    const plate = this._buildCleanPlate(key);
    if (!mc || !plate) return false;
    top.setMatcap(key, mc.rgba, mc.size);
    this._cleanPlates.set(key, plate);
    return true;
  }

  /** Draws colour `key` with its top half turned by thetaDeg (ctx in 1x sprite units). */
  _drawSpriteWithTop(ctx, key, img, thetaDeg) {
    const heroEl = typeof document !== 'undefined' ? document.getElementById('screen-timer-hero') : null;
    const heroVisible = !heroEl || !heroEl.classList.contains('hidden');
    if ((heroVisible || this._top3D || Math.abs(thetaDeg) > 0.01) && this._topReady(key)) {
      const top = this._top3D;
      const texOpts = {
        grain: key === 'completed' ? 0.004 : 0.056,
        mottle: key === 'completed' ? 0.006 : 0.034,
      };
      if (top.render(thetaDeg, key, texOpts)) {
        ctx.drawImage(this._cleanPlates.get(key), 0, 0, this.baseW, this.baseH);
        const B = TOP.box;
        ctx.drawImage(top.canvas, B.x0, B.y0, B.x1 - B.x0, B.y1 - B.y0);
        return;
      }
    }
    ctx.drawImage(img, 0, 0, this.baseW, this.baseH);
  }

  /**
   * Computes realistic 3D studio-lit paint color for a marking at cylindrical angle thetaRad (-PI/2 .. +PI/2).
   * In 02-hero-timer.png, the studio key light is on the top-left (negative sinT),
   * while the right side (positive sinT) turns into soft 3D shadow.
   * This shades the paint brightness physically instead of fading alpha unnaturally!
   */
  _getLitPaintStyle(sinT, cosT, edgeAlpha = 1.0) {
    // Key light factor: 1.0 on left cheek (sinT = -0.7), 0.88 at center (sinT = 0), 0.56 in right shadow (sinT = +0.85)
    const light = Math.max(0.50, Math.min(1.02, 0.86 - 0.32 * sinT + 0.08 * cosT));
    const r = Math.round(246 * light);
    const g = Math.round(202 * light);
    const b = Math.round(198 * light);
    const alpha = 0.86 * Math.max(0.0, Math.min(1.0, edgeAlpha));
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
  }

  render() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const scale = 2; // 2x Retina canvas
    ctx.save();
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.scale(scale, scale);

    // Smooth cosine-eased blend factor [0..1] between active heirloom color and Satin Silver Metallic
    const sBlend = 0.5 * (1.0 - Math.cos(Math.PI * Math.max(0.0, Math.min(1.0, this.silverBlend))));

    // Draw base Heirloom Tomato (or Matte Neutral Grey when unassigned)
    const key = this.isAssigned ? (this.quadrantIndex ?? 0) : 'unassigned';
    const drawnKey = this.images.get(key) ? key : 0;
    const img = this.images.get(drawnKey);
    // The top half turns a full 360° with the dial, at the same surface speed as the numbers
    const twistDeg = (this.currentAngleDegrees / 6.0) * TOP_DEG_PER_MINUTE;
    if (img && img.complete && sBlend < 0.999) {
      ctx.globalAlpha = 1.0;
      this._drawSpriteWithTop(ctx, drawnKey, img, twistDeg);
    }

    // Smoothly cross-dissolve into Satin Silver Metallic Tomato when completed/ended
    if (sBlend > 0.001) {
      const silverImg = this.images.get('completed');
      if (silverImg && silverImg.complete) {
        ctx.globalAlpha = sBlend;
        this._drawSpriteWithTop(ctx, 'completed', silverImg, twistDeg);
      }
    }
    ctx.restore();

    // Project the 2D Odometer Texture Strip onto the 3D Tomato Surface Mesh with 4x horizontal supersampling
    const currentMinutes = this.currentAngleDegrees / 6.0;
    const degPerMin = 3.0;
    const pxPerMin = this.pxPerMin;
    const stripW = this.stripW;
    const stripAlpha = this.stripAlpha;
    const data = this.bandImageData.data;

    // Clear previous frame's alpha channel in the band buffer
    for (let i = 3; i < data.length; i += 4) {
      data[i] = 0;
    }

    const invBlend = 1.0 - sBlend;
    const numberZoneBottomSV = this.stripH - 38;
    const count = this.meshCount;
    for (let n = 0; n < count; n++) {
      const thetaDeg = this.meshThetaDeg[n];
      const mVal = currentMinutes + thetaDeg / degPerMin;
      const uCenter = (mVal + 5.0) * pxPerMin;
      if (uCenter < 1.0 || uCenter >= stripW - 2.0) continue;

      const sv = this.meshSV[n];

      // Ensure every number label (0, 10, 20, ..., 180) is ALWAYS shown as a complete whole number
      // and never sliced in half at the tomato edge (e.g. '10' must never have its '1' clipped into '0')
      let wholeCharVisibility = 1.0;
      if (sv < numberZoneBottomSV) {
        const nearestLabelMin = Math.round(mVal * 0.1) * 10.0;
        const labelCenterTheta = Math.abs((nearestLabelMin - currentMinutes) * degPerMin);
        if (labelCenterTheta > 78.2) continue;
        if (labelCenterTheta > 75.8) {
          wholeCharVisibility = (78.2 - labelCenterTheta) / (78.2 - 75.8);
        }
      }

      const iy = sv | 0;
      const fy = sv - iy;
      const row0 = iy * stripW;
      const row1 = row0 + stripW;
      const du = this.meshDuDsx[n];

      // 4x horizontal supersampling across (-0.375, -0.125, +0.125, +0.375)
      let alphaSum = 0.0;
      for (let s = -0.375; s <= 0.375; s += 0.25) {
        const uS = uCenter + s * du;
        const ix = uS | 0;
        const fx = uS - ix;
        const a00 = stripAlpha[row0 + ix];
        const a10 = stripAlpha[row0 + ix + 1];
        const a01 = stripAlpha[row1 + ix];
        const a11 = stripAlpha[row1 + ix + 1];
        alphaSum +=
          (1.0 - fx) * (1.0 - fy) * a00 +
          fx * (1.0 - fy) * a10 +
          (1.0 - fx) * fy * a01 +
          fx * fy * a11;
      }

      if (alphaSum <= 2.0) continue;
      const alphaTex = alphaSum * (0.25 / 255.0) * wholeCharVisibility;
      const outIdx = this.meshPixelIdx[n];
      data[outIdx] = (this.meshPR[n] * invBlend + this.meshSilverPR[n] * sBlend) | 0;
      data[outIdx + 1] = (this.meshPG[n] * invBlend + this.meshSilverPG[n] * sBlend) | 0;
      data[outIdx + 2] = (this.meshPB[n] * invBlend + this.meshSilverPB[n] * sBlend) | 0;
      data[outIdx + 3] = Math.round(alphaTex * this.meshBaseAlpha[n] * 255.0);
    }

    this.bandCtx.putImageData(this.bandImageData, 0, 0);
    ctx.drawImage(
      this.bandCanvas,
      (this.offsetX + this.bandX0) * scale,
      (this.offsetY + this.bandY0) * scale
    );
  }
}

export class GridTomatoRenderer {
  getDataURL(paletteKey) {
    if (paletteKey === 'unassigned' || paletteKey === 'unassignedDark' || paletteKey === 'unassignedLight') {
      return HEIRLOOM_PALETTE.unassigned.gridImg;
    }
    const entry = HEIRLOOM_PALETTE[paletteKey] || HEIRLOOM_PALETTE[0];
    return entry.gridImg;
  }

  getMiniDataURL(paletteKey) {
    if (paletteKey === null || paletteKey === undefined || paletteKey === 'unassigned') {
      return HEIRLOOM_PALETTE.unassigned.miniImg;
    }
    const entry = HEIRLOOM_PALETTE[paletteKey] || HEIRLOOM_PALETTE[0];
    return entry.miniImg;
  }
}
