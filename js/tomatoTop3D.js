/**
 * TomatoTop3D — the hero tomato's top half as a real 3D object (WebGL2), so it turns a full 360°
 * with the dial: a lobed dome with a well around the stem, five sculpted leaves (sepals) and the
 * stem, all one rigid body with a real back side.
 *
 * Sculpt (measured from the hero photo): the leaves are broad, low-relief crescents moulded into
 * the dome (not separate strips), so they are a displacement of the dome surface and can never
 * float or leave gaps. Each leaf starts under the stem collar and curls sideways as it runs over
 * the shoulder; the five differ slightly (length, width, curl), so the back looks different from
 * the front and a full turn reads as a turn.
 *
 * Look: lit by the studio light captured from the photo itself (a "matcap": colour per surface
 * direction, read from the sprite), plus soft shadows from the key light and contact shadows
 * (ambient occlusion). The light is fixed and the body moves, so highlights stay put while lobes,
 * leaves, their shadows and the fine surface grain turn — like a real kitchen timer under a lamp.
 *
 * Coordinates: body space in sprite pixels (the hero sprite is 700 x 600). Y up the stem axis
 * (Y = 0 at the seam plane), X right, Z toward the camera when the dial reads 0. Longitude phi is
 * measured from +Z toward +X. The camera looks down by e (sin e = 33.4 / 215.5, from the seam
 * ellipse). View space after the dial turn by theta:
 *   X' = X cos - Z sin,  Z' = Z cos + X sin             (features move left as minutes go up)
 *   Xv = X',  Yv = Y cos e - Z' sin e,  Zv = Y sin e + Z' cos e   (Zv toward the camera)
 * Sprite pixel: sx = cx + Xv, sy = ys0 - Yv.
 */

export const TOP_GEOMETRY = {
  cx: 331.5, // stem / turning axis (sprite x)
  ys0: 265.4, // sprite y of the axis at the seam plane (= seam side points)
  sinE: 33.4 / 215.5, // camera tilt
  a: 216.0, // seam radius
  b: 175.0, // dome height above the seam plane
  p: 3.0, // superellipse exponent (flat shoulders), fitted to the sprite outline
  box: { x0: 108, y0: 54, x1: 556, y1: 306 }, // working box (sprite px)
  // The stem sits in a shallow well (the photo's stem base is ~15 px below the shoulder line)
  wellDepth: 31.0,
  wellRadius: 54.0,
  // Five gentle lobes between the leaves (shape that visibly turns); round below the number band
  lobes: 5,
  lobeAmp: 0.02,
  lobePhase: 19.5, // deg, between the leaves
  // Leaves: root angle (deg; 0 = front at dial 0, + = right), curl from root to tip (deg),
  // root/tip radius (px, horizontal), half-width and relief height (px). Tips land at about
  // -33 + 72k deg, which is where the photo shows them.
  leaves: [
    { root: 4, curl: -37, r0: 17, r1: 144, w: 15.4, h: 10.8 }, // front-left in the photo
    { root: 76, curl: -37, r0: 17, r1: 136, w: 14.4, h: 9.8 }, // front-right
    { root: 148, curl: -32, r0: 17, r1: 130, w: 15.8, h: 10.4 }, // back-right
    { root: 219, curl: -39, r0: 17, r1: 139, w: 14.0, h: 9.6 }, // behind the stem
    { root: 292, curl: -33, r0: 17, r1: 133, w: 15.2, h: 10.6 }, // back-left
  ],
  // Stem: surface of revolution traced from the photo [Y, radius]; the flared foot dips below the
  // well so it always meets the dome. A slight lean and faint ridges make its turning visible.
  stem: [
    [128, 42],
    [134, 36],
    [139, 31.5],
    [143, 28.2],
    [147, 25.6],
    [151, 23.5],
    [155, 21.9],
    [160, 20.5],
    [166, 19.2],
    [172, 18.0],
    [178, 16.9],
    [184, 15.9],
    [189, 15.1],
    [192, 14.8],
  ],
  stemCap: { y0: 192, r: 14.8, top: 203.8, exp: 2.0 }, // rounded tip (half-ellipse cap)
  stemLean: { px: 1.6, deg: 90 }, // top of the stem leans 1.6 px to the right at dial 0
  // Studio key light (view space, pointing toward the light): upper left, slightly in front
  light: [-0.5, 0.8, 0.33],
};

const G = TOP_GEOMETRY;
const COS_E = Math.sqrt(1 - G.sinE * G.sinE);
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

function clamp01(t) {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}
function smooth01(t) {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}
function wrapPi(a) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

/** Smooth dome height at reference radius r0 (superellipse + the well around the stem). */
function profileY(r0) {
  const t = Math.min(1, Math.max(0, r0 / G.a));
  const y = G.b * Math.pow(Math.max(0, 1 - Math.pow(t, G.p)), 1 / G.p);
  return y - G.wellDepth * Math.exp(-(r0 * r0) / (G.wellRadius * G.wellRadius));
}

/** Radial bulge factor of the lobes at longitude phi (rad) for reference radius r0 and height y. */
function lobeFactor(phi, r0, y) {
  const env = smooth01((y - 70) / 60) * smooth01((r0 - 45) / 40);
  if (env <= 0) return 0;
  const ph = phi - G.lobePhase * DEG;
  const shape = Math.cos(G.lobes * ph) + 0.28 * Math.cos(3 * ph + 1.1) + 0.18 * Math.cos(2 * ph - 0.7);
  return G.lobeAmp * env * shape * 0.7;
}

/** Leaf relief (px, along the dome normal) at reference radius r0 and longitude phi. */
const LEAVES = G.leaves.map((L, k) => {
  const len = L.r1 - L.r0;
  return {
    ...L,
    k,
    len,
    rootRad: L.root * DEG,
    curlRad: L.curl * DEG,
    tipRound: Math.min(0.24, 15 / len), // ~15 px rounded tip
  };
});
function leafCurl(s) {
  // a steady crescent, curling slightly more toward the tip
  return Math.pow(clamp01(s), 1.15);
}
function leafCurlSlope(s) {
  return 1.15 * Math.pow(Math.max(1e-4, clamp01(s)), 0.15);
}
function leafWidth(L, s) {
  const body = 0.55 + 0.45 * smooth01(s / 0.3) - 0.14 * smooth01((s - 0.4) / 0.6);
  const tt = (s - (1 - L.tipRound)) / L.tipRound;
  const tip = tt > 0 ? Math.sqrt(Math.max(0, 1 - tt * tt)) : 1;
  return L.w * body * tip;
}
function leafHeight(L, s) {
  const rise = smooth01((s + 0.03) / 0.28);
  const fall = 1 - 0.16 * smooth01((s - 0.35) / 0.65);
  const tt = (s - (1 - L.tipRound)) / L.tipRound;
  const tip = tt > 0 ? Math.pow(Math.max(0, 1 - tt * tt), 0.3) : 1;
  return L.h * rise * fall * tip;
}
function leafRelief(r0, phi) {
  // soft collar around the stem foot where the leaf roots merge
  let best = 4.2 * Math.exp(-Math.pow((r0 - 25) / 8.5, 2));
  for (let i = 0; i < LEAVES.length; i++) {
    const L = LEAVES[i];
    const s = (r0 - L.r0) / L.len;
    if (s < -0.03 || s > 1) continue;
    const sc = clamp01(s);
    const phiC = L.rootRad + L.curlRad * leafCurl(sc);
    const dphi = wrapPi(phi - phiC);
    if (Math.abs(dphi) > 1.35) continue;
    // lateral distance on the surface, corrected for the slant of the curling centreline
    const slope = (r0 * Math.abs(L.curlRad) * leafCurlSlope(sc)) / L.len;
    const d = (Math.abs(dphi) * r0) / Math.sqrt(1 + slope * slope);
    const w = leafWidth(L, sc);
    if (w <= 0.05 || d >= w) continue;
    const u = d / w;
    // plump, softly rounded body: gently domed top, sides rolling smoothly into the dome
    const t = clamp01((1 - u) / 0.62);
    const body = t * t * (3 - 2 * t) * (0.93 + 0.07 * (1 - u * u));
    const h = leafHeight(L, sc) * body;
    if (h > best) best = h;
  }
  return best;
}

/** Dome surface (no leaves) for reference radius r0 and longitude phi: [X, Y, Z]. */
function basePoint(r0, phi, out) {
  const y = profileY(r0);
  const r = r0 * (1 + lobeFactor(phi, r0, y));
  out[0] = r * Math.sin(phi);
  out[1] = y;
  out[2] = r * Math.cos(phi);
  return out;
}

/** Outward unit normal of the dome (no leaves) at (r0, phi), by central differences. */
const _bn = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
function baseNormal(r0, phi) {
  const dr = 0.4;
  const dp = 0.4 / Math.max(8, r0);
  const a1 = basePoint(r0 + dr, phi, _bn[0]);
  const a0 = basePoint(Math.max(0, r0 - dr), phi, _bn[1]);
  const b1 = basePoint(r0, phi + dp, _bn[2]);
  const b0 = basePoint(r0, phi - dp, _bn[3]);
  const ax = a1[0] - a0[0];
  const ay = a1[1] - a0[1];
  const az = a1[2] - a0[2];
  const bx = b1[0] - b0[0];
  const by = b1[1] - b0[1];
  const bz = b1[2] - b0[2];
  // outward normal = dR x dPhi
  const nx = ay * bz - az * by;
  const ny = az * bx - ax * bz;
  const nz = ax * by - ay * bx;
  const l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}

export class TomatoTop3D {
  static create() {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = (G.box.x1 - G.box.x0) * 2;
      canvas.height = (G.box.y1 - G.box.y0) * 2;
      const gl = canvas.getContext('webgl2', {
        alpha: true,
        antialias: true,
        depth: true,
        premultipliedAlpha: true,
        preserveDrawingBuffer: true,
      });
      if (!gl) return null;
      const t = new TomatoTop3D(canvas, gl);
      return t.ok ? t : null;
    } catch (_) {
      return null;
    }
  }

  constructor(canvas, gl) {
    this.canvas = canvas;
    this.gl = gl;
    this.matcaps = new Map();
    this.ok = false;
    this._initPrograms();
    this._buildMesh();
    this._initShadowMap();
    this.ok = !gl.isContextLost();
  }

  // ---------------------------------------------------------------- shaders
  _compile(type, src) {
    const gl = this.gl;
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error('TomatoTop3D shader: ' + gl.getShaderInfoLog(sh));
    }
    return sh;
  }

  _program(vs, fs) {
    const gl = this.gl;
    const pr = gl.createProgram();
    gl.attachShader(pr, this._compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(pr, this._compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(pr, 0, 'aPos');
    gl.bindAttribLocation(pr, 1, 'aNor');
    gl.bindAttribLocation(pr, 2, 'aAO');
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) {
      throw new Error('TomatoTop3D link: ' + gl.getProgramInfoLog(pr));
    }
    return pr;
  }

  _initPrograms() {
    const common = `
      uniform float uCos;
      uniform float uSin;
      uniform vec2 uE;          // sin e, cos e
      vec3 toView(vec3 p) {
        vec3 r = vec3(p.x * uCos - p.z * uSin, p.y, p.z * uCos + p.x * uSin);
        return vec3(r.x, r.y * uE.y - r.z * uE.x, r.y * uE.x + r.z * uE.y);
      }
      uniform vec3 uLu;
      uniform vec3 uLv;
      uniform vec3 uLw;
      uniform vec4 uLightBox;   // u centre, v centre, half size, depth half range
      vec3 toLight(vec3 v) {
        return vec3(dot(v, uLu) - uLightBox.x, dot(v, uLv) - uLightBox.y, dot(v, uLw)) / vec3(uLightBox.z, uLightBox.z, uLightBox.w);
      }
    `;
    const depthVS = `#version 300 es
      layout(location = 0) in vec3 aPos;
      ${common}
      void main() {
        vec3 l = toLight(toView(aPos));
        gl_Position = vec4(l.x, l.y, -l.z, 1.0);
      }`;
    const depthFS = `#version 300 es
      precision mediump float;
      out vec4 o;
      void main() { o = vec4(1.0); }`;
    const mainVS = `#version 300 es
      layout(location = 0) in vec3 aPos;
      layout(location = 1) in vec3 aNor;
      layout(location = 2) in float aAO;
      ${common}
      uniform vec2 uCenter;     // cx, ys0
      uniform vec4 uBox;        // x0, y0, w, h
      out vec3 vNor;
      out float vAO;
      out vec3 vBody;
      out vec3 vLight;
      out vec2 vSprite;
      void main() {
        vec3 v = toView(aPos);
        vNor = toView(aNor);
        vAO = aAO;
        vBody = aPos;
        vec3 l = toLight(v + normalize(vNor) * 0.9); // normal offset: no self-shadow acne
        vLight = vec3(l.x, l.y, -l.z); // same depth convention as the light pass
        vec2 s = vec2(uCenter.x + v.x, uCenter.y - v.y);
        vSprite = s;
        gl_Position = vec4((s.x - uBox.x) / uBox.z * 2.0 - 1.0, 1.0 - (s.y - uBox.y) / uBox.w * 2.0, -v.z / 420.0, 1.0);
      }`;
    const mainFS = `#version 300 es
      precision highp float;
      precision highp sampler2DShadow;
      in vec3 vNor;
      in float vAO;
      in vec3 vBody;
      in vec3 vLight;
      in vec2 vSprite;
      uniform sampler2D uMatcap;
      uniform sampler2DShadow uShadow;
      uniform vec3 uLw;
      uniform float uShadowK;
      uniform float uGrain;
      uniform float uMottle;
      uniform float uTexel;
      out vec4 o;
      float hash(vec3 p) {
        p = fract(p * vec3(0.1031, 0.1030, 0.0973));
        p += dot(p, p.yxz + 33.33);
        return fract((p.x + p.y) * p.z);
      }
      float vnoise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float n000 = hash(i), n100 = hash(i + vec3(1, 0, 0)), n010 = hash(i + vec3(0, 1, 0)), n110 = hash(i + vec3(1, 1, 0));
        float n001 = hash(i + vec3(0, 0, 1)), n101 = hash(i + vec3(1, 0, 1)), n011 = hash(i + vec3(0, 1, 1)), n111 = hash(i + vec3(1, 1, 1));
        return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y), mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
      }
      float seamY(float x) {
        float u = clamp((x - 330.5) / 215.5, -1.0, 1.0);
        return 298.8 + 0.5 * u - 18.2 * u * u - 15.2 * u * u * u * u;
      }
      void main() {
        vec3 n = normalize(vNor);
        vec3 col = texture(uMatcap, clamp(n.xy * 0.5 + 0.5, 0.0, 1.0)).rgb;
        // soft key-light shadow (only on surfaces that face the light; the matcap darkens the rest)
        vec3 sc = vLight * 0.5 + 0.5;
        float lit = 0.0;
        for (int i = -1; i <= 1; i++) {
          for (int j = -1; j <= 1; j++) {
            lit += texture(uShadow, vec3(sc.xy + vec2(float(i), float(j)) * uTexel * 1.5, sc.z - 0.0012));
          }
        }
        lit /= 9.0;
        float facing = smoothstep(0.04, 0.32, dot(n, uLw));
        float shade = mix(1.0, mix(1.0 - uShadowK, 1.0, lit), facing);
        // surface grain + faint mottling, fixed to the body so they turn with it
        float g = vnoise(vBody * 1.2) * 0.62 + vnoise(vBody * 2.7) * 0.38;
        float m = vnoise(vBody * 0.045 + 7.3) * 0.6 + vnoise(vBody * 0.11 + 3.1) * 0.4;
        col *= shade * vAO * (1.0 + uGrain * (g - 0.5) * 2.0) * (1.0 + uMottle * (m - 0.5) * 2.0);
        float a = smoothstep(6.0, 13.0, seamY(vSprite.x) - vSprite.y);
        o = vec4(col * a, a);
      }`;
    this.progDepth = this._program(depthVS, depthFS);
    this.progMain = this._program(mainVS, mainFS);
    const gl = this.gl;
    const u = (pr, names) => {
      const m = {};
      names.forEach((n) => (m[n] = gl.getUniformLocation(pr, n)));
      return m;
    };
    const shared = ['uCos', 'uSin', 'uE', 'uLu', 'uLv', 'uLw', 'uLightBox'];
    this.uDepth = u(this.progDepth, shared);
    this.uMain = u(
      this.progMain,
      shared.concat(['uCenter', 'uBox', 'uMatcap', 'uShadow', 'uShadowK', 'uGrain', 'uMottle', 'uTexel'])
    );
  }

  // ---------------------------------------------------------------- geometry
  _buildMesh() {
    // ---- dome rings: reference radii from the stem out to the seam (fine where the leaves are)
    const ringR = [];
    {
      const rIn = 10;
      let r0 = rIn;
      while (r0 < 158) {
        ringR.push(r0);
        r0 += 0.8;
      }
      // beyond the leaves: even arc length along the profile (~2.2 px) down to the seam
      let lastR = r0;
      let lastY = profileY(r0);
      let acc = 0;
      const fine = 3000;
      const t0 = Math.acos(Math.pow(Math.min(1, r0 / G.a), G.p / 2));
      ringR.push(r0);
      for (let i = 1; i <= fine; i++) {
        const t = t0 * (1 - i / fine); // superellipse angle from the shoulder (t0) to the seam (0)
        const r = G.a * Math.pow(Math.max(0, Math.cos(t)), 2 / G.p);
        const y = profileY(r);
        acc += Math.hypot(r - lastR, y - lastY);
        lastR = r;
        lastY = y;
        if (acc >= 2.2 || i === fine) {
          ringR.push(i === fine ? G.a : r);
          acc = 0;
        }
      }
    }
    const NR = ringR.length;
    const SEG = 600;
    const NV = NR * SEG;
    const P = new Float32Array(NV * 3);
    const H = new Float32Array(NV); // leaf relief per vertex (for the contact shadows)
    const tmp0 = [0, 0, 0];
    for (let i = 0; i < NR; i++) {
      const r0 = ringR[i];
      const cap = r0 < 160;
      for (let j = 0; j < SEG; j++) {
        const phi = (j / SEG) * TAU;
        const v = i * SEG + j;
        basePoint(r0, phi, tmp0);
        let h = 0;
        if (cap) h = leafRelief(r0, phi);
        H[v] = h;
        if (h > 0) {
          // displace along the dome normal
          const nb = baseNormal(r0, phi);
          tmp0[0] += nb[0] * h;
          tmp0[1] += nb[1] * h;
          tmp0[2] += nb[2] * h;
        }
        P[v * 3] = tmp0[0];
        P[v * 3 + 1] = tmp0[1];
        P[v * 3 + 2] = tmp0[2];
      }
    }
    // normals: from the displaced grid on the smooth dome; on and around the leaves from the
    // continuous surface itself (tiny central differences), so the grid can't leave ribbing
    const N = new Float32Array(NV * 3);
    const surf = (r0, phi, out) => {
      basePoint(r0, phi, out);
      const h = r0 < 160 ? leafRelief(r0, phi) : 0;
      if (h > 0) {
        const nb = baseNormal(r0, phi);
        out[0] += nb[0] * h;
        out[1] += nb[1] * h;
        out[2] += nb[2] * h;
      }
      return out;
    };
    const q0 = [0, 0, 0];
    const q1 = [0, 0, 0];
    const q2 = [0, 0, 0];
    const q3 = [0, 0, 0];
    for (let i = 0; i < NR; i++) {
      const i0 = Math.max(0, i - 1);
      const i1 = Math.min(NR - 1, i + 1);
      for (let j = 0; j < SEG; j++) {
        const jm = (j + SEG - 1) % SEG;
        const jp = (j + 1) % SEG;
        const a0 = (i0 * SEG + j) * 3;
        const a1 = (i1 * SEG + j) * 3;
        const b0 = (i * SEG + jm) * 3;
        const b1 = (i * SEG + jp) * 3;
        const ax = P[a1] - P[a0];
        const ay = P[a1 + 1] - P[a0 + 1];
        const az = P[a1 + 2] - P[a0 + 2];
        const bx = P[b1] - P[b0];
        const by = P[b1 + 1] - P[b0 + 1];
        const bz = P[b1 + 2] - P[b0 + 2];
        let nx = ay * bz - az * by;
        let ny = az * bx - ax * bz;
        let nz = ax * by - ay * bx;
        const r0 = ringR[i];
        if (r0 < 160 && (H[i * SEG + j] > 0 || H[i * SEG + jm] > 0 || H[i * SEG + jp] > 0 || H[i0 * SEG + j] > 0 || H[i1 * SEG + j] > 0)) {
          const phi = (j / SEG) * TAU;
          const e = 0.3;
          const ep = e / Math.max(8, r0);
          surf(r0 + e, phi, q0);
          surf(r0 - e, phi, q1);
          surf(r0, phi + ep, q2);
          surf(r0, phi - ep, q3);
          const cx = q0[0] - q1[0];
          const cy = q0[1] - q1[1];
          const cz = q0[2] - q1[2];
          const dx = q2[0] - q3[0];
          const dy = q2[1] - q3[1];
          const dz = q2[2] - q3[2];
          nx = cy * dz - cz * dy;
          ny = cz * dx - cx * dz;
          nz = cx * dy - cy * dx;
        }
        const l = Math.hypot(nx, ny, nz) || 1;
        const v = (i * SEG + j) * 3;
        N[v] = nx / l;
        N[v + 1] = ny / l;
        N[v + 2] = nz / l;
      }
    }
    // contact shadows: crevices where the relief is lower than its surroundings (blurred relief)
    const AO = new Float32Array(NV);
    {
      const B = new Float32Array(H);
      const T = new Float32Array(NV);
      const radPx = 5.5;
      for (let pass = 0; pass < 2; pass++) {
        // around each ring
        for (let i = 0; i < NR; i++) {
          const r0 = ringR[i];
          const step = (TAU * Math.max(8, r0)) / SEG;
          const k = Math.max(1, Math.round(radPx / step));
          const row = i * SEG;
          let acc = 0;
          for (let j = -k; j <= k; j++) acc += B[row + ((j + SEG) % SEG)];
          for (let j = 0; j < SEG; j++) {
            T[row + j] = acc / (2 * k + 1);
            acc += B[row + ((j + k + 1) % SEG)] - B[row + ((j - k + SEG) % SEG)];
          }
        }
        // across the rings (outward)
        for (let j = 0; j < SEG; j++) {
          for (let i = 0; i < NR; i++) {
            const sp = i < NR - 1 ? ringR[i + 1] - ringR[i] : 1;
            const k = Math.max(1, Math.round(radPx / Math.max(0.3, sp)));
            let acc = 0;
            let n = 0;
            for (let q = Math.max(0, i - k); q <= Math.min(NR - 1, i + k); q++) {
              acc += T[q * SEG + j];
              n++;
            }
            B[i * SEG + j] = acc / n;
          }
        }
      }
      for (let i = 0; i < NR; i++) {
        const r0 = ringR[i];
        const crevice = 0.26 * Math.exp(-Math.pow((r0 - 24.5) / 6, 2)); // where the stem meets the well
        const well = 0.1 * Math.exp(-(r0 * r0) / (44 * 44));
        for (let j = 0; j < SEG; j++) {
          const v = i * SEG + j;
          const cav = Math.max(0, B[v] - H[v]);
          const occ = Math.min(0.6, cav * 0.15);
          AO[v] = (1 - occ) * (1 - crevice) * (1 - well);
        }
      }
    }

    // ---- stem
    const stemRings = [];
    {
      const prof = G.stem.slice();
      const C = G.stemCap;
      for (let k = 1; k <= 14; k++) {
        const t = k / 14;
        const y = C.y0 + (C.top - C.y0) * (1 - Math.pow(1 - t, 1.6));
        const f = Math.min(1, (y - C.y0) / (C.top - C.y0));
        prof.push([y, C.r * Math.pow(Math.max(0, 1 - Math.pow(f, C.exp)), 1 / C.exp)]);
      }
      for (let k = 0; k < prof.length - 1; k++) {
        const [y0, r0] = prof[k];
        const [y1, r1] = prof[k + 1];
        const len = Math.hypot(y1 - y0, r1 - r0);
        const n = Math.max(1, Math.round(len / 0.9));
        for (let q = 0; q < n; q++) {
          const t = q / n;
          stemRings.push([y0 + (y1 - y0) * t, r0 + (r1 - r0) * t]);
        }
      }
      stemRings.push(prof[prof.length - 1]);
    }
    const SNR = stemRings.length;
    const SSEG = 120;
    const SNV = SNR * SSEG;
    const SP = new Float32Array(SNV * 3);
    const leanX = G.stemLean.px * Math.sin(G.stemLean.deg * DEG);
    const leanZ = G.stemLean.px * Math.cos(G.stemLean.deg * DEG);
    for (let i = 0; i < SNR; i++) {
      const [y, r] = stemRings[i];
      const lt = Math.pow(clamp01((y - 152) / 52), 2);
      for (let j = 0; j < SSEG; j++) {
        const phi = (j / SSEG) * TAU;
        // faint moulded ridges (fade out at the rounded tip and the foot)
        const ridge = (0.022 * Math.cos(5 * phi + 1.3) + 0.012 * Math.cos(3 * phi - 0.4)) * smooth01((y - 152) / 8) * smooth01((190 - y) / 6);
        const rr = r * (1 + ridge);
        const v = (i * SSEG + j) * 3;
        SP[v] = rr * Math.sin(phi) + leanX * lt;
        SP[v + 1] = y;
        SP[v + 2] = rr * Math.cos(phi) + leanZ * lt;
      }
    }
    const SN = new Float32Array(SNV * 3);
    for (let i = 0; i < SNR; i++) {
      const i0 = Math.max(0, i - 1);
      const i1 = Math.min(SNR - 1, i + 1);
      for (let j = 0; j < SSEG; j++) {
        const jm = (j + SSEG - 1) % SSEG;
        const jp = (j + 1) % SSEG;
        const a0 = (i0 * SSEG + j) * 3;
        const a1 = (i1 * SSEG + j) * 3;
        const b0 = (i * SSEG + jm) * 3;
        const b1 = (i * SSEG + jp) * 3;
        // up the stem x around it gives the outward normal
        const ax = SP[a1] - SP[a0];
        const ay = SP[a1 + 1] - SP[a0 + 1];
        const az = SP[a1 + 2] - SP[a0 + 2];
        const bx = SP[b1] - SP[b0];
        const by = SP[b1 + 1] - SP[b0 + 1];
        const bz = SP[b1 + 2] - SP[b0 + 2];
        let nx = by * az - bz * ay;
        let ny = bz * ax - bx * az;
        let nz = bx * ay - by * ax;
        let l = Math.hypot(nx, ny, nz);
        const v = (i * SSEG + j) * 3;
        if (l < 1e-6) {
          nx = 0;
          ny = 1;
          nz = 0;
          l = 1;
        }
        SN[v] = nx / l;
        SN[v + 1] = ny / l;
        SN[v + 2] = nz / l;
      }
    }
    const SAO = new Float32Array(SNV);
    for (let i = 0; i < SNR; i++) {
      const y = stemRings[i][0];
      const a = 0.62 + 0.38 * smooth01((y - 148) / 18);
      for (let j = 0; j < SSEG; j++) SAO[i * SSEG + j] = a;
    }

    // ---- upload
    const total = NV + SNV;
    const pos = new Float32Array(total * 3);
    const nor = new Float32Array(total * 3);
    const ao = new Float32Array(total);
    pos.set(P, 0);
    pos.set(SP, NV * 3);
    nor.set(N, 0);
    nor.set(SN, NV * 3);
    ao.set(AO, 0);
    ao.set(SAO, NV);
    const quadsDome = (NR - 1) * SEG;
    const quadsStem = (SNR - 1) * SSEG;
    const idx = new Uint32Array((quadsDome + quadsStem) * 6);
    let q = 0;
    for (let i = 0; i < NR - 1; i++) {
      for (let j = 0; j < SEG; j++) {
        const j1 = (j + 1) % SEG;
        const a = i * SEG + j;
        const b = i * SEG + j1;
        const c = (i + 1) * SEG + j;
        const d = (i + 1) * SEG + j1;
        idx[q++] = a;
        idx[q++] = c;
        idx[q++] = b;
        idx[q++] = b;
        idx[q++] = c;
        idx[q++] = d;
      }
    }
    for (let i = 0; i < SNR - 1; i++) {
      for (let j = 0; j < SSEG; j++) {
        const j1 = (j + 1) % SSEG;
        const a = NV + i * SSEG + j;
        const b = NV + i * SSEG + j1;
        const c = NV + (i + 1) * SSEG + j;
        const d = NV + (i + 1) * SSEG + j1;
        idx[q++] = a;
        idx[q++] = c;
        idx[q++] = b;
        idx[q++] = b;
        idx[q++] = c;
        idx[q++] = d;
      }
    }

    const gl = this.gl;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const buf = (data, loc, size) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    buf(pos, 0, 3);
    buf(nor, 1, 3);
    buf(ao, 2, 1);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    this.indexCount = idx.length;
    gl.bindVertexArray(null);
    this.vertexCount = total;
  }

  /** Sprite-pixel points covering the leaves + stem at dial 0 (to keep them out of the matcap). */
  footprintAtZero() {
    const pts = [];
    const tmp = [0, 0, 0];
    const proj = (X, Y, Z) => [G.cx + X, G.ys0 - (Y * COS_E - Z * G.sinE)];
    for (const L of LEAVES) {
      for (let s = 0; s <= 1.0001; s += 0.02) {
        const r0 = L.r0 + L.len * s;
        const phiC = L.rootRad + L.curlRad * leafCurl(s);
        const w = leafWidth(L, s) + 3;
        for (let u = -1; u <= 1.001; u += 0.25) {
          const phi = phiC + (u * w) / Math.max(8, r0);
          basePoint(r0, phi, tmp);
          pts.push(proj(tmp[0], tmp[1] + leafHeight(L, s) + 1, tmp[2]));
        }
      }
    }
    return pts;
  }

  // ---------------------------------------------------------------- shadows
  _initShadowMap() {
    const gl = this.gl;
    this.shadowSize = 1024;
    this.shadowTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, this.shadowSize, this.shadowSize);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    this.shadowFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // light frame (view space)
    const l = Math.hypot(G.light[0], G.light[1], G.light[2]);
    const w = [G.light[0] / l, G.light[1] / l, G.light[2] / l];
    const helper = Math.abs(w[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    let uAx = [helper[1] * w[2] - helper[2] * w[1], helper[2] * w[0] - helper[0] * w[2], helper[0] * w[1] - helper[1] * w[0]];
    const ul = Math.hypot(uAx[0], uAx[1], uAx[2]);
    uAx = [uAx[0] / ul, uAx[1] / ul, uAx[2] / ul];
    const vAx = [w[1] * uAx[2] - w[2] * uAx[1], w[2] * uAx[0] - w[0] * uAx[2], w[0] * uAx[1] - w[1] * uAx[0]];
    this.lightFrame = { u: uAx, v: vAx, w };
    // bounding sphere of the top half in view space: centre near (0, ~100, 0), radius ~255
    const c = [0, 100 * COS_E, 100 * G.sinE];
    this.lightBox = [
      c[0] * uAx[0] + c[1] * uAx[1] + c[2] * uAx[2],
      c[0] * vAx[0] + c[1] * vAx[1] + c[2] * vAx[2],
      258,
      300,
    ];
  }

  // ---------------------------------------------------------------- matcap
  hasMatcap(key) {
    return this.matcaps.has(key);
  }

  /** rgba: Uint8Array(size * size * 4); row j holds ny = -1 + 2 j / (size - 1). */
  setMatcap(key, rgba, size) {
    const gl = this.gl;
    let tex = this.matcaps.get(key);
    if (!tex) {
      tex = gl.createTexture();
      this.matcaps.set(key, tex);
    }
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  // ---------------------------------------------------------------- render
  _setShared(u, thetaDeg) {
    const gl = this.gl;
    const th = thetaDeg * DEG;
    gl.uniform1f(u.uCos, Math.cos(th));
    gl.uniform1f(u.uSin, Math.sin(th));
    gl.uniform2f(u.uE, G.sinE, COS_E);
    gl.uniform3fv(u.uLu, this.lightFrame.u);
    gl.uniform3fv(u.uLv, this.lightFrame.v);
    gl.uniform3fv(u.uLw, this.lightFrame.w);
    gl.uniform4fv(u.uLightBox, this.lightBox);
  }

  /** Renders the top half at dial angle theta (deg) with the matcap of `key`. Returns false if not possible. */
  render(thetaDeg, key, opts = {}) {
    const gl = this.gl;
    if (!this.ok || gl.isContextLost()) return false;
    const matcap = this.matcaps.get(key);
    if (!matcap) return false;

    // 1) depth from the key light
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.viewport(0, 0, this.shadowSize, this.shadowSize);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.disable(gl.CULL_FACE);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.progDepth);
    this._setShared(this.uDepth, thetaDeg);
    gl.bindVertexArray(this.vao);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_INT, 0);

    // 2) the picture
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.progMain);
    const u = this.uMain;
    this._setShared(u, thetaDeg);
    gl.uniform2f(u.uCenter, G.cx, G.ys0);
    gl.uniform4f(u.uBox, G.box.x0, G.box.y0, G.box.x1 - G.box.x0, G.box.y1 - G.box.y0);
    gl.uniform1f(u.uShadowK, opts.shadow ?? 0.48);
    gl.uniform1f(u.uGrain, opts.grain ?? 0.03);
    gl.uniform1f(u.uMottle, opts.mottle ?? 0.025);
    gl.uniform1f(u.uTexel, 1 / this.shadowSize);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, matcap);
    gl.uniform1i(u.uMatcap, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.uniform1i(u.uShadow, 1);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
    return true;
  }
}
