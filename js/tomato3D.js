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

import { TomatoTop3D, TOP_GEOMETRY } from './tomatoTop3D.js?v=20261015_v80';

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
    // Load the tomatoes needed first (red, grey, silver) before the rest, so on a slow phone
    // connection the hero / tutorial tomato isn't starved by six other downloads.
    const firstBatch = [0, 'unassigned', 'completed'];
    const secondBatch = keys.filter((k) => !firstBatch.includes(k));
    let firstPending = firstBatch.length;
    const loadKey = (k, onDone) => {
      const entry = HEIRLOOM_PALETTE[k];
      if (!entry) {
        if (onDone) onDone();
        return;
      }
      const img = new Image();
      img.decoding = 'async';
      let retried = false;
      img.onload = () => {
        this.images.set(k, img);
        const heroEl =
          typeof document !== 'undefined' ? document.getElementById('screen-hero') : null;
        if (!heroEl || !heroEl.classList.contains('hidden')) {
          this.render();
        }
        if (this.images.size === keys.length) this._warmUpTwist();
        if (onDone) onDone();
      };
      img.onerror = () => {
        // One retry on flaky mobile networks
        if (!retried) {
          retried = true;
          setTimeout(() => {
            img.src = entry.heroImg + (entry.heroImg.includes('?') ? '&' : '?') + 'r=1';
          }, 800);
          return;
        }
        if (onDone) onDone();
      };
      img.src = entry.heroImg;
    };
    let secondStarted = false;
    const startSecond = () => {
      if (secondStarted) return;
      secondStarted = true;
      secondBatch.forEach((k) => loadKey(k, null));
    };
    firstBatch.forEach((k) =>
      loadKey(k, () => {
        firstPending -= 1;
        if (firstPending <= 0) startSecond();
      })
    );
    // Never hold the remaining colours back for too long
    setTimeout(startSecond, 12000);
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
      const aboutEl =
        typeof document !== 'undefined' ? document.getElementById('about-modal-overlay') : null;
      if (aboutEl && !aboutEl.classList.contains('hidden')) {
        setTimeout(() => idle(runNext), 1200);
        return;
      }
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

    // Build a shared 2x Retina studio backdrop + floor shadow plate (with 100% of the 1x tomato
    // body, 1x edge fringe, and dark bottom rim cleanly erased) so the 2x Retina 3D Lower Bowl
    // sits directly on the smooth studio backdrop and floor shadow with zero rough borderline.
    const bw = this.baseW;
    const bh = this.baseH;
    const backdrop2x = document.createElement('canvas');
    backdrop2x.width = bw * 2;
    backdrop2x.height = bh * 2;
    try {
      const c1x = document.createElement('canvas');
      c1x.width = bw;
      c1x.height = bh;
      const cctx = c1x.getContext('2d', { willReadFrequently: true });
      cctx.drawImage(refImg, 0, 0, bw, bh);
      const fullData = cctx.getImageData(0, 0, bw, bh);
      const fpx = fullData.data;

      const rawTom = new Uint8Array(bw * bh);
      const yPoleRef = 436.6;
      for (let y = 52; y < 444; y++) {
        const t = Math.max(0.0, Math.min(1.0, (y - TOP.ys0) / (yPoleRef - TOP.ys0)));
        const rEst =
          y <= TOP.ys0
            ? TOP.a
            : TOP.a *
                Math.pow(
                  Math.max(0.0, 1.0 - Math.pow(t, 1.84 + 0.36 * t * t)),
                  0.452 - 0.038 * t * t
                ) +
              2.6 * t * t * (1.0 - t);
        for (let x = 106; x < 558; x++) {
          const i4 = (y * bw + x) * 4;
          const rgDiff = fpx[i4] - fpx[i4 + 1];
          const inCore = y >= 92 && y <= 436 && Math.abs(x - TOP.cx) <= rEst - 0.5;
          if (rgDiff >= 9 || inCore) {
            rawTom[y * bw + x] = 1;
          }
        }
      }
      // Also include the upper-half solid mask (stem + back leaves)
      for (let by = 0; by < H; by++) {
        for (let bx = 0; bx < W; bx++) {
          if (solid[by * W + bx]) {
            rawTom[(B.y0 + by) * bw + (B.x0 + bx)] = 1;
          }
        }
      }

      // Dilate by 4 px in the upper half and by a 9 px circular radius in the lower half (y >= 250)
      // so the entire 8x8 JPEG block-ringing halo outside the bottom & bottom-right edge is erased.
      const eraseTom = new Uint8Array(bw * bh);
      for (let y = 48; y < 450; y++) {
        const rad = y >= 250 ? 9 : 4;
        const rad2 = rad * rad;
        for (let x = 96; x < 568; x++) {
          let hit = false;
          for (let dy = -rad; dy <= rad && !hit; dy++) {
            const yy = y + dy;
            if (yy < 0 || yy >= bh) continue;
            const dy2 = dy * dy;
            for (let dx = -rad; dx <= rad && !hit; dx++) {
              if (dy2 + dx * dx > rad2) continue;
              const xx = x + dx;
              if (xx >= 0 && xx < bw && rawTom[yy * bw + xx]) hit = true;
            }
          }
          if (hit) eraseTom[y * bw + x] = 1;
        }
      }

      const yBotErase = new Int16Array(bw);
      for (let x = 96; x < 568; x++) {
        let yb = -1;
        for (let y = 449; y >= 48; y--) {
          if (eraseTom[y * bw + x]) {
            yb = y;
            break;
          }
        }
        yBotErase[x] = yb;
      }

      const origPx = new Uint8ClampedArray(fpx);
      // Precompute clean, horizontally smoothed floor shadow colors below yBotErase[x]
      // (sampled 2..6 px outside eraseTom, completely past the 8x8 DCT halo)
      const botR = new Float32Array(bw);
      const botG = new Float32Array(bw);
      const botB = new Float32Array(bw);
      const yBotSmooth = new Float32Array(bw);
      for (let x = 96; x < 568; x++) {
        let syb = 0;
        let sc = 0;
        let sr = 0;
        let sg = 0;
        let sb = 0;
        let cCnt = 0;
        for (let dx = -5; dx <= 5; dx++) {
          const xx = Math.max(96, Math.min(567, x + dx));
          const yb = yBotErase[xx];
          if (yb > 0) {
            syb += yb;
            sc++;
            for (let dy = 2; dy <= 6; dy++) {
              const yy = Math.min(bh - 1, yb + dy);
              if (!eraseTom[yy * bw + xx]) {
                const ii = (yy * bw + xx) * 4;
                sr += origPx[ii];
                sg += origPx[ii + 1];
                sb += origPx[ii + 2];
                cCnt++;
              }
            }
          }
        }
        yBotSmooth[x] = sc > 0 ? syb / sc : -1;
        if (cCnt > 0) {
          botR[x] = sr / cCnt;
          botG[x] = sg / cCnt;
          botB[x] = sb / cCnt;
        }
      }
      // Smooth botR/G/B horizontally so adjacent columns never form vertical streaks
      const botRs = new Float32Array(bw);
      const botGs = new Float32Array(bw);
      const botBs = new Float32Array(bw);
      for (let x = 96; x < 568; x++) {
        let sr = 0;
        let sg = 0;
        let sb = 0;
        let cnt = 0;
        for (let dx = -6; dx <= 6; dx++) {
          const xx = x + dx;
          if (xx >= 96 && xx < 568 && yBotSmooth[xx] > 0) {
            sr += botR[xx];
            sg += botG[xx];
            sb += botB[xx];
            cnt++;
          }
        }
        if (cnt > 0) {
          botRs[x] = sr / cnt;
          botGs[x] = sg / cnt;
          botBs[x] = sb / cnt;
        }
      }

      const sampleOuterPatch = (cx0, cy0) => {
        let sr = 0;
        let sg = 0;
        let sb = 0;
        let cnt = 0;
        for (let dy = -2; dy <= 2; dy++) {
          const yy = Math.max(0, Math.min(bh - 1, cy0 + dy));
          for (let dx = -2; dx <= 2; dx++) {
            const xx = Math.max(0, Math.min(bw - 1, cx0 + dx));
            if (!eraseTom[yy * bw + xx]) {
              const ii = (yy * bw + xx) * 4;
              sr += origPx[ii];
              sg += origPx[ii + 1];
              sb += origPx[ii + 2];
              cnt++;
            }
          }
        }
        if (cnt === 0) {
          const ii = (cy0 * bw + cx0) * 4;
          return [origPx[ii], origPx[ii + 1], origPx[ii + 2]];
        }
        return [sr / cnt, sg / cnt, sb / cnt];
      };

      for (let y = 48; y < 450; y++) {
        let x = 96;
        while (x < 568) {
          if (!eraseTom[y * bw + x]) {
            x++;
            continue;
          }
          const start = x;
          while (x < 568 && eraseTom[y * bw + x]) x++;
          const end = x - 1;
          const lCol = sampleOuterPatch(Math.max(0, start - 4), y);
          const rCol = sampleOuterPatch(Math.min(bw - 1, end + 4), y);
          const span = Math.max(1, end - start + 2);
          // In the lower shadow zone (y >= 305), reach 100% right-side shadow color by cx + 10
          // so bright left-side studio background never bleeds into the bottom or bottom-right shadow.
          const shadowBlend = smoothstep01((y - 295) / 40);
          const rightPivot = start + span * (1.0 - 0.46 * shadowBlend);
          const effSpan = Math.max(1, rightPivot - start);

          for (let xx = start; xx <= end; xx++) {
            const tH = smoothstep01(Math.min(1.0, (xx - start + 1) / effSpan));
            let r = lCol[0] * (1 - tH) + rCol[0] * tH;
            let g = lCol[1] * (1 - tH) + rCol[1] * tH;
            let b = lCol[2] * (1 - tH) + rCol[2] * tH;
            const yb = yBotSmooth[xx];
            if (y >= 305 && yb > 0 && botRs[xx] > 0) {
              const wBot = smoothstep01((y - (yb - 44)) / 44);
              r = r * (1 - wBot) + botRs[xx] * wBot;
              g = g * (1 - wBot) + botGs[xx] * wBot;
              b = b * (1 - wBot) + botBs[xx] * wBot;
            }
            const o = (y * bw + xx) * 4;
            fpx[o] = Math.round(r);
            fpx[o + 1] = Math.round(g);
            fpx[o + 2] = Math.round(b);
          }
        }
      }

      // Dilate the smoothing mask 5 px beyond eraseTom and run two passes of 7x7 smoothing
      // so the transition from inpainted shadow to outer studio floor is completely seamless.
      const smoothMask = new Uint8Array(bw * bh);
      for (let y = 260; y < 455; y++) {
        for (let x = 92; x < 572; x++) {
          let hit = false;
          for (let dy = -5; dy <= 5 && !hit; dy++) {
            const yy = y + dy;
            if (yy < 0 || yy >= bh) continue;
            for (let dx = -5; dx <= 5 && !hit; dx++) {
              const xx = x + dx;
              if (xx >= 0 && xx < bw && eraseTom[yy * bw + xx]) hit = true;
            }
          }
          if (hit) smoothMask[y * bw + x] = 1;
        }
      }

      let srcBuf = new Uint8ClampedArray(fpx);
      let dstBuf = new Uint8ClampedArray(fpx);
      for (let pass = 0; pass < 2; pass++) {
        for (let y = 265; y < 455; y++) {
          for (let x = 94; x < 570; x++) {
            if (!smoothMask[y * bw + x]) continue;
            let sr = 0;
            let sg = 0;
            let sb = 0;
            let cnt = 0;
            for (let dy = -3; dy <= 3; dy++) {
              const yy = y + dy;
              for (let dx = -3; dx <= 3; dx++) {
                const ii = (yy * bw + (x + dx)) * 4;
                sr += srcBuf[ii];
                sg += srcBuf[ii + 1];
                sb += srcBuf[ii + 2];
                cnt++;
              }
            }
            const o = (y * bw + x) * 4;
            dstBuf[o] = Math.round(sr / cnt);
            dstBuf[o + 1] = Math.round(sg / cnt);
            dstBuf[o + 2] = Math.round(sb / cnt);
          }
        }
        srcBuf.set(dstBuf);
      }
      fullData.data.set(dstBuf);
      cctx.putImageData(fullData, 0, 0);

      const b2ctx = backdrop2x.getContext('2d', { willReadFrequently: true });
      b2ctx.imageSmoothingEnabled = true;
      b2ctx.imageSmoothingQuality = 'high';
      b2ctx.drawImage(c1x, 0, 0, bw * 2, bh * 2);
    } catch (_) {}

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
      backdrop2x,
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
    if (!top || !M) return null;
    const size = MATCAP_SIZE;

    // For Polished Silver Trophy ('completed'), synthesize a high-contrast mirror-polished chrome/silver
    // studio environment matcap matching the gleaming softbox highlights, dark metallic reflection lobes,
    // and bright Fresnel rim reflections of a real polished silver trophy across BOTH halves.
    if (key === 'completed') {
      const rgba = new Uint8Array(size * size * 4);
      const gauss2 = (x, y, cx, cy, sx, sy, rot = 0) => {
        const c = Math.cos(rot);
        const s = Math.sin(rot);
        const dx = x - cx;
        const dy = y - cy;
        const u = (dx * c + dy * s) / sx;
        const v = (-dx * s + dy * c) / sy;
        return Math.exp(-0.5 * (u * u + v * v));
      };
      for (let v = 0; v < size; v++) {
        for (let u = 0; u < size; u++) {
          let nx = (u / (size - 1)) * 2 - 1;
          let ny = (v / (size - 1)) * 2 - 1;
          const rr = Math.hypot(nx, ny);
          if (rr > 0.999) {
            nx *= 0.999 / rr;
            ny *= 0.999 / rr;
          }
          const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
          const fresnel = Math.pow(1 - nz, 2.1);

          // Base sterling silver body: ~208 on the top crown so the 3D calyx leaves & stem have rich
          // metallic relief, with bright Fresnel edge sheen around the outer silhouette.
          const crownCool = 14 * Math.max(0, ny - 0.45);
          let lum = 198 + 8 * ny - crownCool + 26 * fresnel;

          // 1. Tight, gleaming pure-white (255) studio softbox highlight on the front-right shoulder
          //    + subtle specular ridge glint at the very top (ny ~ 0.94) for leaf crests & stem tip
          const mainSoftbox =
            68 * gauss2(nx, ny, 0.30, 0.38, 0.22, 0.15, -0.26) +
            32 * gauss2(nx, ny, 0.44, 0.16, 0.18, 0.18, -0.15) +
            22 * gauss2(nx, ny, -0.46, 0.58, 0.22, 0.12, 0.38);

          // 2. Crisp pinpoint mirror-silver hotspot (gleams to 255 on the right shoulder & leaf ridges)
          const hotSpot =
            34 * gauss2(nx, ny, 0.28, 0.40, 0.11, 0.085, -0.24) +
            28 * gauss2(nx, ny, 0.14, 0.94, 0.18, 0.055, 0.0);

          // 3. Sculpted sterling-silver dark reflection lobes (~134..150, matching hero-tomato-silver.png's
          //    upper half without looking black or smudged)
          const darkCenterLobe = 58 * gauss2(nx, ny, -0.10, 0.17, 0.30, 0.13, 0.08);
          const darkLeftShoulder = 52 * gauss2(nx, ny, -0.50, 0.36, 0.17, 0.22, -0.48);
          const darkTopWell = 22 * gauss2(nx, ny, -0.06, 0.66, 0.28, 0.14, 0.0);
          const darkRightFlank = 34 * gauss2(nx, ny, 0.72, 0.28, 0.13, 0.22, 0.34);

          // 4. Crisp metallic horizon glint just above the equatorial split (ny ~ 0.035)
          const seamUpperGlint = 20 * gauss2(nx, ny, 0.18, 0.035, 0.42, 0.04, 0.0);

          // 5. Lower-bowl polished silver trophy reflections:
          //    - Smooth sterling-silver horizon reflection below the bright lower lip
          //    - Gleaming studio tabletop specular reflection across the lower-front/right bowl
          //    - Smooth metallic underside (~140..156) with a crisp silver Fresnel bottom rim catchlight
          const darkLowerHorizon = 46 * gauss2(nx, ny, -0.12, -0.16, 0.38, 0.10, 0.06);
          const brightTableBounce =
            56 * gauss2(nx, ny, 0.18, -0.38, 0.34, 0.16, -0.20) +
            34 * gauss2(nx, ny, -0.20, -0.46, 0.32, 0.15, 0.16);
          const darkUnderBelly = 52 * gauss2(nx, ny, -0.04, -0.82, 0.52, 0.14, 0.04);

          // 6. Gleaming silver Fresnel edge reflection around the left/right/bottom silhouette rim
          const sideRimGleam =
            36 * Math.pow(Math.max(0, Math.abs(nx) - 0.58) / 0.42, 1.55) * (1 - 0.28 * Math.max(0, -ny));
          const bottomRimCatch = 28 * gauss2(nx, ny, 0.06, -0.95, 0.46, 0.055, 0.0);

          lum +=
            mainSoftbox +
            hotSpot +
            seamUpperGlint +
            brightTableBounce +
            sideRimGleam +
            bottomRimCatch -
            darkCenterLobe -
            darkLeftShoulder -
            darkTopWell -
            darkRightFlank -
            darkLowerHorizon -
            darkUnderBelly;

          // Polished sterling-silver tone curve: dark chrome reflections around 126..146,
          // silky silver midtones around 195..218, and gleaming 255 specular softbox highlights.
          const norm = Math.max(0, Math.min(1, (lum - 118) / (264 - 118)));
          const sCurve = norm * norm * (3 - 2 * norm);
          const finalLum = 122 + 133 * (0.42 * norm + 0.58 * sCurve);

          const k4 = (v * size + u) * 4;
          // Cool-neutral sterling silver tint (tiny cool blue-silver shift in midtones, pure white at 255)
          const hi = Math.pow(Math.max(0, (finalLum - 180) / 75), 1.5);
          rgba[k4] = Math.round(Math.max(0, Math.min(255, finalLum * (0.990 + 0.010 * hi))));
          rgba[k4 + 1] = Math.round(Math.max(0, Math.min(255, finalLum * (0.996 + 0.004 * hi))));
          rgba[k4 + 2] = Math.round(Math.max(0, Math.min(255, finalLum * 1.006)));
          rgba[k4 + 3] = 255;
        }
      }
      return { rgba, size };
    }

    const src = this._twistReadSprite(key);
    if (!src) return null;
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
   * Builds the 2x Retina Clean Plate (`1400x1200`) for colour `key`:
   * Starts from the 100% tomato-free studio backdrop + floor shadow plate (`M.backdrop2x`) and
   * renders the stationary 3D Lower Bowl at full 2x Retina resolution using the exact same axis
   * (`cx = 330.5`), equatorial radius (`a = 216.0`), studio matcap (`mc.rgba`), and multi-scale
   * heirloom skin texture as `TomatoTop3D`, complete with:
   * - A real 3D physical two-piece split at the equator (recessed shadow slot + rounded lower-bowl
   *   upper lip catching a soft studio rim highlight + 3D silhouette bevel notch at the left/right edges),
   * - Silky 2x Retina sub-pixel anti-aliasing along the entire bottom outline (zero rough borderline),
   * - Crisp 2x Retina sculpted `▲` pointer marker.
   */
  _buildCleanPlate(key, mc) {
    const M = this._topMasks();
    if (!M || !M.backdrop2x || !mc) return null;
    const { W, backdrop2x, sampleTile } = M;
    const B = TOP.box;

    const plate2x = document.createElement('canvas');
    plate2x.width = this.baseW * 2;
    plate2x.height = this.baseH * 2;
    const pctx = plate2x.getContext('2d', { willReadFrequently: true });
    pctx.drawImage(backdrop2x, 0, 0);

    const botY0 = 246;
    const botY1 = 442;
    const botH = botY1 - botY0;
    const x0_2 = B.x0 * 2;
    const y0_2 = botY0 * 2;
    const W2 = W * 2;
    const H2 = botH * 2;

    const mRgba = mc.rgba;
    const mSize = mc.size;
    const sampleMC = (nx, ny, out) => {
      const u = Math.max(0, Math.min(1, nx * 0.5 + 0.5)) * (mSize - 1);
      const v = Math.max(0, Math.min(1, ny * 0.5 + 0.5)) * (mSize - 1);
      const u0 = u | 0;
      const v0 = v | 0;
      const u1 = u0 < mSize - 1 ? u0 + 1 : u0;
      const v1 = v0 < mSize - 1 ? v0 + 1 : v0;
      const fu = u - u0;
      const fv = v - v0;
      const i00 = (v0 * mSize + u0) * 4;
      const i10 = (v0 * mSize + u1) * 4;
      const i01 = (v1 * mSize + u0) * 4;
      const i11 = (v1 * mSize + u1) * 4;
      const w00 = (1 - fu) * (1 - fv);
      const w10 = fu * (1 - fv);
      const w01 = (1 - fu) * fv;
      const w11 = fu * fv;
      out[0] = mRgba[i00] * w00 + mRgba[i10] * w10 + mRgba[i01] * w01 + mRgba[i11] * w11;
      out[1] = mRgba[i00 + 1] * w00 + mRgba[i10 + 1] * w10 + mRgba[i01 + 1] * w01 + mRgba[i11 + 1] * w11;
      out[2] = mRgba[i00 + 2] * w00 + mRgba[i10 + 2] * w10 + mRgba[i01 + 2] * w01 + mRgba[i11 + 2] * w11;
    };

    const ys0 = TOP.ys0;
    const yPole = 436.6;
    const a = TOP.a;
    const cx = TOP.cx;
    const rBowlAt = (sy) => {
      if (sy <= ys0) return a;
      if (sy >= yPole) return 0;
      const t = (sy - ys0) / (yPole - ys0);
      return (
        a *
          Math.pow(
            Math.max(0.0, 1.0 - Math.pow(t, 1.84 + 0.36 * t * t)),
            0.452 - 0.038 * t * t
          ) +
        2.6 * t * t * (1.0 - t)
      );
    };

    try {
      const b2Data = pctx.getImageData(x0_2, y0_2, W2, H2);
      const px2 = b2Data.data;
      const isSilver = key === 'completed';
      const grainAmt = isSilver ? 0.004 : 0.056;
      const mottleAmt = isSilver ? 0.006 : 0.034;
      const rgb = [0, 0, 0];

      for (let by2 = 0; by2 < H2; by2++) {
        const sy = botY0 + by2 * 0.5;
        if (sy >= yPole + 1.0) continue;
        const rBowl = rBowlAt(sy);
        if (rBowl <= 0.5) continue;
        const drDsy = (rBowlAt(sy + 0.5) - rBowlAt(sy - 0.5));
        const t = Math.max(0.0, Math.min(1.0, (sy - ys0) / (yPole - ys0)));
        const row2 = by2 * W2;

        for (let bx2 = 0; bx2 < W2; bx2++) {
          const sx = B.x0 + bx2 * 0.5;
          const dx = sx - cx;
          const ax = Math.abs(dx);
          if (ax > rBowl + 1.5) continue;

          const seamS = twistSeamScreenY(sx);
          const dBelow = sy - seamS;
          if (dBelow < -1.2) continue;

          // Real 3D physical two-piece split: at dBelow ≈ 0, the outer silhouette indents slightly
          // where the rounded upper and lower lips meet at the recessed split slot.
          const splitNotch = 1.15 * Math.exp(-(dBelow * dBelow) / 1.45);
          const rEff = rBowl - splitNotch;
          const slopeScale = Math.hypot(1.0, drDsy * (ax / Math.max(18.0, rBowl)));
          const perpDist = (rEff - ax) / slopeScale;
          if (perpDist <= -0.75) continue;

          const alphaOut = smoothstep01((perpDist + 0.65) / 1.30);
          if (alphaOut <= 0.001) continue;

          const u = Math.max(-1.0, Math.min(1.0, dx / a));
          // 3D outward surface normal (nx, ny) on the lower bowl
          let nx = (dx / a) * (1.0 - 0.36 * t) + (dx / Math.max(52.0, rBowl)) * (0.36 * t);
          nx = Math.max(-0.98, Math.min(0.98, nx));
          let ny = 0.12 - 0.94 * Math.pow(t, 0.92);

          // 1) Recessed mechanical split slot right at the seam (dBelow ≈ 0..0.9 px)
          const gSlot = Math.exp(-Math.pow((dBelow - 0.32) / 0.88, 2));
          // 2) Rounded upper lip of the lower bowl (dBelow ∈ [0.55, 5.2] px):
          //    rolls outward from the split slot so its normal tilts upward toward the studio light
          let lipUp = 0.0;
          if (dBelow > 0.45 && dBelow < 5.4) {
            const uLip = Math.max(0.0, Math.min(1.0, (dBelow - 0.45) / 4.6));
            lipUp = Math.sin(Math.PI * Math.pow(uLip, 0.72)) * (1.0 - 0.34 * u * u);
            ny += 0.48 * lipUp * (1.0 - gSlot);
          }

          // 3D lower-bowl surface coordinates for unified 2x Retina skin grain + mottle + micro-bump
          const Z = Math.sqrt(Math.max(25.0, a * a - dx * dx - dBelow * dBelow * 1.35));
          const u3 = dx + Z * 0.42;
          const v3 = dBelow * 1.08 + Z * 0.36;

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
          const mottle =
            sampleTile(u3 * 0.055 + 11.3, v3 * 0.055 + 53.1) * 0.58 +
            sampleTile(u3 * 0.14 + 83.7, v3 * 0.14 + 29.8) * 0.42 -
            0.5;

          const gx = (fineX - fine0) * (grainAmt * 0.48);
          const gy = (fineY - fine0) * (grainAmt * 0.48);
          sampleMC(nx + gx, ny + gy, rgb);

          // Split slot occlusion + lower-lip studio rim highlight + gentle tabletop contact AO
          const slotDepth = (isSilver ? 0.68 : 0.68) * (1.0 - 0.18 * Math.pow(Math.abs(u), 3));
          const slotAO = 1.0 - slotDepth * gSlot;
          const keySide = isSilver
            ? Math.max(0.35, 0.88 + 0.26 * Math.cos((u - 0.18) * 2.2))
            : Math.max(0.18, 0.78 - 0.46 * nx);
          const lipRim = 1.0 + (isSilver ? 0.22 : 0.10) * lipUp * keySide * (1.0 - gSlot);
          const groundAO = 1.0 - (isSilver ? 0.08 : 0.18) * Math.pow(Math.max(0.0, (t - 0.68) / 0.32), 1.55);
          const texFactor =
            (1.0 + grainAmt * fine0 * 2.0) * (1.0 + mottleAmt * mottle * 2.0) * (1.0 - 0.5 * gSlot) +
            0.5 * gSlot;

          const totalShade = slotAO * lipRim * groundAO * texFactor;
          let rCol = Math.max(0, Math.min(255, rgb[0] * totalShade));
          let gCol = Math.max(0, Math.min(255, rgb[1] * totalShade));
          let bCol = Math.max(0, Math.min(255, rgb[2] * totalShade));

          // Crisp 2x Retina sculpted `▲` pointer marker at cx = 330.5, sy ∈ [318.2, 336.4]
          if (sy >= 317.2 && sy <= 337.4 && ax <= 10.5) {
            const py0 = 318.4;
            const py1 = 336.2;
            const halfBase = 8.2;
            const tTri = (sy - py0) / (py1 - py0);
            const maxX = tTri * halfBase;
            const dSides = (maxX - ax) * 0.894;
            const dBot = py1 - sy;
            const dTop = sy - py0;
            const dTri = Math.min(dSides, dBot, dTop + 0.8);
            if (dTri > -0.65) {
              const aTri = smoothstep01((dTri + 0.55) / 1.10);
              const ptrR = isSilver ? 82 : 228;
              const ptrG = isSilver ? 84 : 206;
              const ptrB = isSilver ? 88 : 202;
              rCol = rCol * (1 - aTri) + ptrR * aTri;
              gCol = gCol * (1 - aTri) + ptrG * aTri;
              bCol = bCol * (1 - aTri) + ptrB * aTri;
            }
          }

          const oIdx = (row2 + bx2) * 4;
          px2[oIdx] = Math.round(px2[oIdx] * (1 - alphaOut) + rCol * alphaOut);
          px2[oIdx + 1] = Math.round(px2[oIdx + 1] * (1 - alphaOut) + gCol * alphaOut);
          px2[oIdx + 2] = Math.round(px2[oIdx + 2] * (1 - alphaOut) + bCol * alphaOut);
        }
      }
      pctx.putImageData(b2Data, x0_2, y0_2);
    } catch (_) {}

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
    if (!mc) return false;
    const plate = this._buildCleanPlate(key, mc);
    if (!plate) return false;
    top.setMatcap(key, mc.rgba, mc.size);
    this._cleanPlates.set(key, plate);
    return true;
  }

  /** Draws colour `key` with its top half turned by thetaDeg (ctx in 1x sprite units). */
  _drawSpriteWithTop(ctx, key, img, thetaDeg) {
    const heroEl = typeof document !== 'undefined' ? document.getElementById('screen-hero') : null;
    const heroVisible = !heroEl || !heroEl.classList.contains('hidden');
    if (
      !this._top3DBroken &&
      (heroVisible || this._top3D || Math.abs(thetaDeg) > 0.01)
    ) {
      try {
        if (this._topReady(key)) {
          const top = this._top3D;
          const texOpts = {
            shadow: key === 'completed' ? 0.24 : 0.48,
            grain: key === 'completed' ? 0.0015 : 0.056,
            mottle: key === 'completed' ? 0.002 : 0.034,
          };
          if (top.render(thetaDeg, key, texOpts) && this._topOutputLooksValid(top)) {
            ctx.drawImage(this._cleanPlates.get(key), 0, 0, this.baseW, this.baseH);
            const B = TOP.box;
            ctx.drawImage(top.canvas, B.x0, B.y0, B.x1 - B.x0, B.y1 - B.y0);
            return;
          }
        }
      } catch (_) {
        this._top3DBroken = true;
      }
    }
    ctx.drawImage(img, 0, 0, this.baseW, this.baseH);
  }

  /**
   * One-time sanity check of the WebGL top half: some phone GPUs / browsers silently return a
   * blank WebGL canvas. If nothing was drawn, fall back to the flat photo so the tomato never vanishes.
   */
  _topOutputLooksValid(top) {
    if (this._topOutputChecked) return !this._top3DBroken;
    try {
      const probe = document.createElement('canvas');
      probe.width = 16;
      probe.height = 16;
      const pctx = probe.getContext('2d', { willReadFrequently: true });
      pctx.drawImage(top.canvas, 0, 0, 16, 16);
      const data = pctx.getImageData(0, 0, 16, 16).data;
      let opaque = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 40) opaque++;
      }
      this._topOutputChecked = true;
      if (opaque < 12) {
        this._top3DBroken = true;
        return false;
      }
      return true;
    } catch (_) {
      this._topOutputChecked = true;
      return true;
    }
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
    // Until the tomato photo has downloaded, draw nothing (never floating dial marks on their own)
    if (!img || !img.complete) {
      ctx.restore();
      return;
    }
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
  constructor() {
    this._preloadedImages = [];
    if (typeof Image !== 'undefined') {
      const urls = new Set();
      Object.values(HEIRLOOM_PALETTE).forEach((entry) => {
        if (entry && entry.gridImg) urls.add(entry.gridImg);
        if (entry && entry.miniImg) urls.add(entry.miniImg);
      });
      urls.forEach((url) => {
        const img = new Image();
        img.decoding = 'sync';
        img.src = url;
        this._preloadedImages.push(img);
      });
    }
  }

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
