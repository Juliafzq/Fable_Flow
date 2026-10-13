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
 * Top-half twist: when the dial turns, the whole upper half (leaves, shoulders, surface)
 * turns with the numbers, like a real kitchen timer.
 *
 * Geometry (sprite px, measured from the hero sprites): the upper half is a surface of
 * revolution around the stem axis with a flat-shouldered superellipse profile
 * (r/a)^p + (Y/b)^p = 1, seen by an orthographic camera tilted down by e (from the seam
 * ellipse: front drop 33.4 px on a 215.5 px radius). Every visible pixel knows which body
 * point it shows; turning by theta re-samples the picture where that body point was.
 *
 * Light stays put: picture = A (smooth studio light) x D (surface detail); only D turns.
 * The calyx has 5 leaves, so a turn is shown modulo 72 deg, cross-fading between the two
 * nearest equivalent poses. That keeps every frame sampled from the sharp, front-facing
 * part of the picture (no smeared leaves after a quarter turn).
 */
const TWIST = {
  cx: 331.5, // stem / turning axis (sprite x)
  ys0: 265.4, // screen y of the axis at the seam plane (= seam side points)
  sinE: 33.4 / 215.5, // camera tilt
  a: 216.0, // seam radius
  b: 175.0, // dome height above the seam plane
  p: 3.0, // superellipse exponent (flat shoulders)
  x0: 108, // working box in sprite px
  y0: 58,
  x1: 556,
  y1: 306,
  // Stem + its collar stay still (they sit on the axis; turning them would only swap their shading)
  stemX0: 314, // stem shaft column
  stemX1: 349,
  stemY1: 94,
  collarCx: 331.5, // collar where the leaves meet the stem (ellipse)
  collarCy: 98,
  collarRx: 25,
  collarRy: 7.5,
  // One leaf-step (72 deg) per 25 minutes: within ~5% of the number band's surface speed at the
  // front (3 / (0.978 * 1.118) = 2.74 deg/min), and every multiple of 25 min shows the original
  // picture. The hand-over between equivalent poses falls on 12.5, 37.5, 62.5 ... min, away from
  // the usual 5-minute settings.
  degPerMinute: 72.0 / 25.0,
  period: 72.0, // 5 leaves
  fadeHalfWidth: 3.0, // deg (about +-1 min of dial) cross-fade around the hand-over
  blurRadius: 18, // 3-pass box blur ~ sigma 18.5 px for the light layer
  // Only the leaves and shoulders visibly turn: the smooth cheeks look the same at any angle,
  // and their soft highlight is studio light (it must stay put), not surface detail.
  latFrom: 120, // body height (px above the seam plane) where turning starts to show
  latFull: 145, // fully turning from here up to the stem
};

const INV_D = 1 / 8192; // detail layer fixed-point scale

function smoothstep01(t) {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

function twistSeamScreenY(spriteX) {
  // getTomatoSeamY works in band-local coords (sprite = local + (80, 40))
  return getTomatoSeamY(spriteX - 80) + 40;
}

/** In-place 3-pass separable box blur (sums; caller normalises with a blurred weight map). */
function boxBlur3(buf, W, H, R) {
  const tmp = new Float32Array(buf.length);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < H; y++) {
      const row = y * W;
      let acc = 0;
      for (let x = 0; x < R && x < W; x++) acc += buf[row + x];
      for (let x = 0; x < W; x++) {
        if (x + R < W) acc += buf[row + x + R];
        if (x - R - 1 >= 0) acc -= buf[row + x - R - 1];
        tmp[row + x] = acc;
      }
    }
    for (let x = 0; x < W; x++) {
      let acc = 0;
      for (let y = 0; y < R && y < H; y++) acc += tmp[y * W + x];
      for (let y = 0; y < H; y++) {
        if (y + R < H) acc += tmp[(y + R) * W + x];
        if (y - R - 1 >= 0) acc -= tmp[(y - R - 1) * W + x];
        buf[y * W + x] = acc;
      }
    }
  }
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

  /** Prepares the top-half twist in idle moments, so the first turn of the dial doesn't stutter. */
  _warmUpTwist() {
    if (this._twWarmStarted) return;
    this._twWarmStarted = true;
    const idle =
      typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'
        ? (fn) => window.requestIdleCallback(fn, { timeout: 2000 })
        : (fn) => setTimeout(fn, 300);
    const steps = [
      () => this._twistGeometry(),
      () => this._twistShared(),
      () => this._twistLayer(this.isAssigned ? (this.quadrantIndex ?? 0) : 'unassigned'),
    ];
    const runNext = () => {
      const step = steps.shift();
      if (!step) return;
      try {
        step();
      } catch (_) {}
      if (steps.length) idle(runNext);
    };
    idle(runNext);
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
    const T = TWIST;
    const cosE = Math.sqrt(1 - T.sinE * T.sinE);
    const W = T.x1 - T.x0;
    const H = T.y1 - T.y0;
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
      const X = T.x0 + bx - T.cx;
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
        const by = yRow - T.y0;
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
    const T = TWIST;
    try {
      const cnv = document.createElement('canvas');
      cnv.width = T.x1 - T.x0;
      cnv.height = T.y1 - T.y0;
      const cctx = cnv.getContext('2d', { willReadFrequently: true });
      cctx.drawImage(img, -T.x0, -T.y0);
      return cctx.getImageData(0, 0, cnv.width, cnv.height).data;
    } catch (_) {
      return null;
    }
  }

  /**
   * Shared by all colours (same sculpt): which pixels turn and how much (soft fade at the outline,
   * the seam groove, the stem and down the smooth cheeks), and how far surface detail is trusted.
   * The outline is read from a deep-coloured sprite, which stands out clearly from the backdrop
   * (pale silver highlights would not).
   */
  _twistShared() {
    if (this._twShared) return this._twShared;
    const refKey = [0, 2, 5, 1, 4, 3, 'unassigned'].find((k) => this.images.get(k));
    if (refKey === undefined) return null;
    const src = this._twistReadSprite(refKey);
    if (!src) {
      this._twShared = false;
      return false;
    }
    const T = TWIST;
    const G = this._twistGeometry();
    const { W, H, N, cover } = G;
    const cosE = Math.sqrt(1 - T.sinE * T.sinE);
    const bgR = src[0];
    const bgG = src[1];
    const bgB = src[2];
    const seamY = new Float32Array(W);
    for (let bx = 0; bx < W; bx++) seamY[bx] = twistSeamScreenY(T.x0 + bx);

    // Tomato pixels (the groove and bottom half count as tomato, so only the real outline is an edge)
    const solid = new Uint8Array(N);
    for (let by = 0; by < H; by++) {
      const y = T.y0 + by;
      for (let bx = 0; bx < W; bx++) {
        const id = by * W + bx;
        const i = id * 4;
        const d =
          Math.abs(src[i] - bgR) + Math.abs(src[i + 1] - bgG) + Math.abs(src[i + 2] - bgB);
        if (d > 30 && (cover[id] || y > seamY[bx] - 3)) solid[id] = 1;
      }
    }

    // Distance (px) to the outline: two-pass chamfer
    const dist = new Float32Array(N);
    for (let id = 0; id < N; id++) dist[id] = solid[id] ? 1e6 : 0;
    for (let by = 0; by < H; by++) {
      for (let bx = 0; bx < W; bx++) {
        const id = by * W + bx;
        let d = dist[id];
        if (d === 0) continue;
        if (bx > 0) d = Math.min(d, dist[id - 1] + 1);
        if (by > 0) {
          d = Math.min(d, dist[id - W] + 1);
          if (bx > 0) d = Math.min(d, dist[id - W - 1] + 1.4142);
          if (bx < W - 1) d = Math.min(d, dist[id - W + 1] + 1.4142);
        }
        dist[id] = d;
      }
    }
    for (let by = H - 1; by >= 0; by--) {
      for (let bx = W - 1; bx >= 0; bx--) {
        const id = by * W + bx;
        let d = dist[id];
        if (d === 0) continue;
        if (bx < W - 1) d = Math.min(d, dist[id + 1] + 1);
        if (by < H - 1) {
          d = Math.min(d, dist[id + W] + 1);
          if (bx < W - 1) d = Math.min(d, dist[id + W + 1] + 1.4142);
          if (bx > 0) d = Math.min(d, dist[id + W - 1] + 1.4142);
        }
        dist[id] = d;
      }
    }

    // wTwist: how much of the turned picture shows. vDetail: how far surface detail is trusted.
    const wTwist = new Float32Array(N);
    const vDetail = new Float32Array(N);
    for (let by = 0; by < H; by++) {
      const y = T.y0 + by;
      for (let bx = 0; bx < W; bx++) {
        const id = by * W + bx;
        if (!cover[id] || !solid[id]) continue;
        const x = T.x0 + bx;
        const up = seamY[bx] - y;
        const sdx = Math.max(T.stemX0 - x, 0, x - T.stemX1);
        const sdy = Math.max(y - T.stemY1, 0);
        const ex = (x - T.collarCx) / T.collarRx;
        const ey = (y - T.collarCy) / T.collarRy;
        const collarD = Math.max(0, Math.sqrt(ex * ex + ey * ey) - 1) * T.collarRy;
        const stemD = Math.min(Math.hypot(sdx, sdy), collarD); // px outside stem + collar
        const e = dist[id];
        const lat = (T.ys0 - G.gC[id]) / cosE; // body height above the seam plane
        wTwist[id] =
          smoothstep01((e - 3) / 5) *
          smoothstep01((up - 6) / 7) *
          smoothstep01(stemD / 6) *
          smoothstep01((lat - T.latFrom) / (T.latFull - T.latFrom));
        vDetail[id] =
          smoothstep01((e - 3) / 4) * smoothstep01((up - 5) / 5) * smoothstep01((stemD - 1) / 5);
      }
    }

    const list = [];
    for (let id = 0; id < N; id++) if (wTwist[id] > 0.002) list.push(id);
    const cnt = list.length;
    const idx = new Int32Array(list);
    const lx = new Float32Array(cnt);
    const lz = new Float32Array(cnt);
    const lc = new Float32Array(cnt);
    const lw = new Uint8ClampedArray(cnt);
    for (let q = 0; q < cnt; q++) {
      const id = idx[q];
      lx[q] = G.gX[id];
      lz[q] = G.gZ[id];
      lc[q] = G.gC[id];
      lw[q] = Math.round(wTwist[id] * 255);
    }
    this._twShared = { vDetail, idx, lx, lz, lc, lw, cnt };
    return this._twShared;
  }

  /** Per-colour light layer A (weighted blur) and detail layer D = picture / A (1 = no detail). */
  _twistLayer(key) {
    if (!this._twLayers) this._twLayers = new Map();
    if (this._twLayers.has(key)) return this._twLayers.get(key);
    const S = this._twistShared();
    if (!S) return null;
    const src = this._twistReadSprite(key);
    if (!src) return null;
    const T = TWIST;
    const { W, H, N } = this._twGeo;
    const vDetail = S.vDetail;

    const den = new Float32Array(N);
    const nr = new Float32Array(N);
    const ng = new Float32Array(N);
    const nb = new Float32Array(N);
    for (let id = 0; id < N; id++) {
      const v = vDetail[id];
      if (v <= 0) continue;
      const i = id * 4;
      den[id] = v;
      nr[id] = src[i] * v;
      ng[id] = src[i + 1] * v;
      nb[id] = src[i + 2] * v;
    }
    const R = T.blurRadius;
    boxBlur3(den, W, H, R);
    boxBlur3(nr, W, H, R);
    boxBlur3(ng, W, H, R);
    boxBlur3(nb, W, H, R);
    const A = new Uint8ClampedArray(N * 3);
    const D = new Uint16Array(N * 3).fill(8192); // detail ratio in 1/8192 steps (8192 = 1.0)
    for (let id = 0; id < N; id++) {
      const i = id * 4;
      const k = id * 3;
      const dn = den[id];
      let ar = src[i];
      let ag = src[i + 1];
      let ab = src[i + 2];
      if (dn > 1e-3) {
        ar = nr[id] / dn;
        ag = ng[id] / dn;
        ab = nb[id] / dn;
      }
      A[k] = ar;
      A[k + 1] = ag;
      A[k + 2] = ab;
      const v = vDetail[id];
      if (v > 0) {
        D[k] = Math.min(65535, Math.round(8192 * (1 + (src[i] / Math.max(ar, 1) - 1) * v)));
        D[k + 1] = Math.min(65535, Math.round(8192 * (1 + (src[i + 1] / Math.max(ag, 1) - 1) * v)));
        D[k + 2] = Math.min(65535, Math.round(8192 * (1 + (src[i + 2] / Math.max(ab, 1) - 1) * v)));
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const lctx = canvas.getContext('2d');
    const image = lctx.createImageData(W, H);
    const layer = { A, D, idx: S.idx, lx: S.lx, lz: S.lz, lc: S.lc, lw: S.lw, cnt: S.cnt, canvas, lctx, image, theta: null };
    this._twLayers.set(key, layer);
    return layer;
  }

  /** Re-samples the detail layer for the two nearest equivalent poses (t1, t2) and writes the layer. */
  _fillTwistLayer(L, t1, g, t2) {
    const T = TWIST;
    const W = this._twGeo.W;
    const H = this._twGeo.H;
    const out = L.image.data;
    const A = L.A;
    const D = L.D;
    const r1 = (t1 * Math.PI) / 180;
    const r2 = (t2 * Math.PI) / 180;
    const c1 = Math.cos(r1);
    const s1 = Math.sin(r1);
    const c2 = Math.cos(r2);
    const s2 = Math.sin(r2);
    const w1 = g;
    const w2 = 1 - g;
    const useSecond = w2 > 0.001;
    const cxb = T.cx - T.x0;
    const sinE = T.sinE;
    const maxX = W - 1.001;
    const maxY = H - 1.001;
    const W3 = W * 3;
    const { lx, lz, lc, lw, idx, cnt } = L;
    for (let q = 0; q < cnt; q++) {
      const X = lx[q];
      const Z = lz[q];
      const C = lc[q] - T.y0;

      let sx = cxb + X * c1 + Z * s1;
      let sy = C + (Z * c1 - X * s1) * sinE;
      sx = sx < 0 ? 0 : sx > maxX ? maxX : sx;
      sy = sy < 0 ? 0 : sy > maxY ? maxY : sy;
      let ix = sx | 0;
      let iy = sy | 0;
      let fx = sx - ix;
      let fy = sy - iy;
      let i00 = iy * W3 + ix * 3;
      let i01 = i00 + W3;
      let a00 = (1 - fx) * (1 - fy);
      let a10 = fx * (1 - fy);
      let a01 = (1 - fx) * fy;
      let a11 = fx * fy;
      let dr = D[i00] * a00 + D[i00 + 3] * a10 + D[i01] * a01 + D[i01 + 3] * a11;
      let dg = D[i00 + 1] * a00 + D[i00 + 4] * a10 + D[i01 + 1] * a01 + D[i01 + 4] * a11;
      let db = D[i00 + 2] * a00 + D[i00 + 5] * a10 + D[i01 + 2] * a01 + D[i01 + 5] * a11;

      if (useSecond) {
        sx = cxb + X * c2 + Z * s2;
        sy = C + (Z * c2 - X * s2) * sinE;
        sx = sx < 0 ? 0 : sx > maxX ? maxX : sx;
        sy = sy < 0 ? 0 : sy > maxY ? maxY : sy;
        ix = sx | 0;
        iy = sy | 0;
        fx = sx - ix;
        fy = sy - iy;
        i00 = iy * W3 + ix * 3;
        i01 = i00 + W3;
        a00 = (1 - fx) * (1 - fy);
        a10 = fx * (1 - fy);
        a01 = (1 - fx) * fy;
        a11 = fx * fy;
        dr = dr * w1 + w2 * (D[i00] * a00 + D[i00 + 3] * a10 + D[i01] * a01 + D[i01 + 3] * a11);
        dg = dg * w1 + w2 * (D[i00 + 1] * a00 + D[i00 + 4] * a10 + D[i01 + 1] * a01 + D[i01 + 4] * a11);
        db = db * w1 + w2 * (D[i00 + 2] * a00 + D[i00 + 5] * a10 + D[i01 + 2] * a01 + D[i01 + 5] * a11);
      }

      const id = idx[q];
      const k = id * 3;
      const o = id * 4;
      out[o] = A[k] * dr * INV_D;
      out[o + 1] = A[k + 1] * dg * INV_D;
      out[o + 2] = A[k + 2] * db * INV_D;
      out[o + 3] = lw[q];
    }
    L.lctx.putImageData(L.image, 0, 0);
  }

  /** Draws the turned upper half of sprite `key` over it (ctx is in 1x sprite units). */
  _drawTwistLayer(ctx, key, thetaDeg) {
    const T = TWIST;
    const P = T.period;
    const half = P / 2;
    const t1 = ((((thetaDeg + half) % P) + P) % P) - half; // nearest equivalent pose, (-36, 36]
    const a1 = Math.abs(t1);
    let g = 1;
    if (a1 > half - T.fadeHalfWidth) {
      g = 1 - smoothstep01((a1 - (half - T.fadeHalfWidth)) / (2 * T.fadeHalfWidth));
    }
    if (g >= 0.9999 && a1 < 0.02) return; // dial at a resting pose: the original picture
    const layer = this._twistLayer(key);
    if (!layer) return;
    const q = Math.round(thetaDeg * 50) / 50;
    if (layer.theta !== q) {
      this._fillTwistLayer(layer, t1, g, t1 - (t1 >= 0 ? P : -P));
      layer.theta = q;
    }
    ctx.drawImage(layer.canvas, T.x0, T.y0);
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
    // The top half turns with the dial at the same surface speed as the numbers
    const twistDeg = (this.currentAngleDegrees / 6.0) * TWIST.degPerMinute;
    if (img && img.complete && sBlend < 0.999) {
      ctx.globalAlpha = 1.0;
      ctx.drawImage(img, 0, 0, this.baseW, this.baseH);
      this._drawTwistLayer(ctx, drawnKey, twistDeg);
    }

    // Smoothly cross-dissolve into Satin Silver Metallic Tomato when completed/ended
    if (sBlend > 0.001) {
      const silverImg = this.images.get('completed');
      if (silverImg && silverImg.complete) {
        ctx.globalAlpha = sBlend;
        ctx.drawImage(silverImg, 0, 0, this.baseW, this.baseH);
        this._drawTwistLayer(ctx, 'completed', twistDeg);
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
