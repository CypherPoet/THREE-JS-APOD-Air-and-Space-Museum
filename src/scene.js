// =================================================================
// Three.js scene — the Air & Space Museum gallery
// =================================================================

import * as THREE from "three";

const COLORS = {
  void:    0x04060d,
  void2:   0x0a0e1a,
  vellum:  0xf5efe2,
  amber:   0xe8743b,
  amber2:  0xf0a06a,
  cyan:    0x5fb3c1,
  rust:    0x8a3a1a,
  marble:  0x16181f,
  pillar:  0xd9d2c0,
};

const GALLERY = {
  radius: 13,        // playable area radius
  pillarRing: 10.5,
  pillarCount: 8,
  pillarHeight: 8,
  ceilingless: true,
};

/**
 * Build the entire gallery and return handles for animation + APOD swap.
 */
export function buildGallery(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.void);
  scene.fog = new THREE.Fog(COLORS.void, 18, 60);

  const camera = new THREE.PerspectiveCamera(
    62,
    window.innerWidth / window.innerHeight,
    0.05,
    400,
  );
  camera.position.set(0, 1.7, 9);
  camera.lookAt(0, 2.5, 0);

  // ---------- SKY ----------
  const sky = buildStarSky();
  scene.add(sky);

  // ---------- FLOOR ----------
  const floor = buildFloor();
  scene.add(floor);

  // ---------- PILLARS ----------
  const pillars = buildPillars();
  scene.add(pillars);

  // ---------- CENTRAL EXHIBIT ----------
  const exhibit = buildExhibit();
  scene.add(exhibit.group);

  // ---------- PLINTH BASE DOTS ----------
  const plinthDots = buildPlinthDots();
  scene.add(plinthDots);

  // ---------- EASTER EGG: coffee mug on the plinth ----------
  const mug = buildCoffeeMug();
  // Plinth top is at y=1.07. Place the mug on the front-right edge
  // (closest to the user's entry point at z=+9) and scale it 1.5× so
  // it reads at a distance.
  mug.group.position.set(0.78, 1.07, 0.95);
  mug.group.rotation.y = -0.35;
  mug.group.scale.setScalar(1.5);
  scene.add(mug.group);

  // ---------- DUST ----------
  const dust = buildDust();
  scene.add(dust.points);

  // ---------- LIGHTING ----------
  const ambient = new THREE.HemisphereLight(0x556080, 0x101018, 0.55);
  scene.add(ambient);

  const moonKey = new THREE.DirectionalLight(0xb8c8e0, 0.45);
  moonKey.position.set(-8, 14, 6);
  scene.add(moonKey);

  const amberRim = new THREE.PointLight(COLORS.amber, 0.95, 22, 1.6);
  amberRim.position.set(0, 4, -2);
  scene.add(amberRim);

  // Subtle cyan accent from the rear
  const cyanFill = new THREE.PointLight(COLORS.cyan, 0.55, 24, 2.0);
  cyanFill.position.set(0, 5, 9);
  scene.add(cyanFill);

  // Up-light on each pillar capital
  const pillarLights = [];
  for (let i = 0; i < GALLERY.pillarCount; i += 1) {
    const angle = (i / GALLERY.pillarCount) * Math.PI * 2;
    const x = Math.cos(angle) * GALLERY.pillarRing;
    const z = Math.sin(angle) * GALLERY.pillarRing;
    const lamp = new THREE.PointLight(COLORS.amber2, 0.45, 6, 1.8);
    lamp.position.set(x, GALLERY.pillarHeight - 0.4, z);
    scene.add(lamp);
    pillarLights.push(lamp);
  }

  // ---------- RESIZE ----------
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  // ---------- ANIMATE ----------
  const clock = new THREE.Clock();
  function update() {
    const elapsed = clock.getElapsedTime();

    // Drift dust slowly upward; recycle when it floats too high
    dust.update(elapsed);

    // Subtle hovering motion on the exhibit frame
    exhibit.update(elapsed);

    // Mug hover-glow lerp + tiny idle bob
    mug.update(elapsed);

    // Pulse the amber rim light gently
    amberRim.intensity = 0.95 + Math.sin(elapsed * 0.6) * 0.10;

    // Advance the cosmic floor overlay (no-op if the overlay is absent)
    if (floor.userData.cosmicMaterial) {
      floor.userData.cosmicMaterial.uniforms.uTime.value = elapsed;
    }

    renderer.render(scene, camera);
  }

  return {
    renderer,
    scene,
    camera,
    update,
    exhibit, // { setApod(texture), getInteractAnchor() }
    mug,     // { group, hitObject, setHover(bool) }
    gallery: GALLERY,
  };
}

// =================================================================
// SKY — procedural starfield on a large inverted sphere
// =================================================================
function buildStarSky() {
  const texture = makeStarTexture();
  const geometry = new THREE.SphereGeometry(180, 64, 32);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const sky = new THREE.Mesh(geometry, material);
  sky.rotation.y = Math.PI;
  return sky;
}

function makeStarTexture() {
  const w = 2048;
  const h = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  // Deep cosmic gradient: navy at horizon, near-black overhead
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0.0, "#02030a");
  bg.addColorStop(0.45, "#070a18");
  bg.addColorStop(0.7, "#0d1226");
  bg.addColorStop(1.0, "#1a1430");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Nebulous color washes
  paintNebula(ctx, w * 0.18, h * 0.65, 380, "rgba(232, 116, 59, 0.25)");
  paintNebula(ctx, w * 0.82, h * 0.5, 420, "rgba(95, 179, 193, 0.22)");
  paintNebula(ctx, w * 0.5, h * 0.35, 260, "rgba(180, 120, 210, 0.18)");

  // The Milky Way: a soft horizontal band
  const band = ctx.createLinearGradient(0, h * 0.42, 0, h * 0.68);
  band.addColorStop(0.0, "rgba(255, 230, 200, 0)");
  band.addColorStop(0.5, "rgba(255, 230, 200, 0.08)");
  band.addColorStop(1.0, "rgba(255, 230, 200, 0)");
  ctx.fillStyle = band;
  ctx.fillRect(0, h * 0.42, w, h * 0.26);

  // Stars at multiple sizes / brightnesses
  paintStars(ctx, w, h, 1800, 0.4, 0.9);   // small dim
  paintStars(ctx, w, h,  600, 0.8, 1.4);   // medium
  paintStars(ctx, w, h,  120, 1.4, 2.4);   // bright
  paintStars(ctx, w, h,   24, 2.4, 3.6);   // very bright with glow

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function paintNebula(ctx, cx, cy, radius, color) {
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grad.addColorStop(0, color);
  grad.addColorStop(1, color.replace(/[\d.]+\)$/, "0)"));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

function paintStars(ctx, w, h, count, minR, maxR) {
  for (let i = 0; i < count; i += 1) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = minR + Math.random() * (maxR - minR);
    const tint = Math.random();
    let color = "rgba(255, 245, 220, ";
    if (tint < 0.15) color = "rgba(170, 200, 255, ";
    else if (tint < 0.30) color = "rgba(255, 180, 140, ";
    const alpha = 0.45 + Math.random() * 0.55;

    if (r > 2) {
      const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
      halo.addColorStop(0, color + alpha + ")");
      halo.addColorStop(0.35, color + alpha * 0.35 + ")");
      halo.addColorStop(1, color + "0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, r * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = color + alpha + ")";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// =================================================================
// FLOOR — polished obsidian disc with concentric grooves
// =================================================================
function buildFloor() {
  const group = new THREE.Group();

  // Main disc
  const discTexture = makeFloorTexture();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(GALLERY.radius + 4, 96),
    new THREE.MeshStandardMaterial({
      map: discTexture,
      color: 0xffffff,
      roughness: 0.36,
      metalness: 0.45,
    }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0;
  group.add(disc);

  // Ring on the outer rim — like a pier
  const rim = new THREE.Mesh(
    new THREE.RingGeometry(GALLERY.radius + 3.5, GALLERY.radius + 4, 96),
    new THREE.MeshStandardMaterial({
      color: COLORS.amber,
      emissive: COLORS.amber,
      emissiveIntensity: 0.18,
      roughness: 0.7,
      metalness: 0.2,
    }),
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.01;
  group.add(rim);

  // Cosmic overlay — additive blooms + star pinpoints, drifts slowly.
  // Sits a hairline above the disc; honors prefers-reduced-motion.
  const cosmicMat = makeCosmicFloorMaterial();
  const cosmic = new THREE.Mesh(
    new THREE.CircleGeometry(GALLERY.radius + 4, 128),
    cosmicMat,
  );
  cosmic.rotation.x = -Math.PI / 2;
  cosmic.position.y = 0.005;
  cosmic.renderOrder = 1;
  group.add(cosmic);
  group.userData.cosmicMaterial = cosmicMat;

  return group;
}

function makeFloorTexture() {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");

  // Dark base
  ctx.fillStyle = "#0c0f17";
  ctx.fillRect(0, 0, size, size);

  // Subtle radial vignette outward
  const vignette = ctx.createRadialGradient(
    size / 2, size / 2, size * 0.05,
    size / 2, size / 2, size * 0.55,
  );
  vignette.addColorStop(0, "rgba(40, 45, 60, 0.4)");
  vignette.addColorStop(0.5, "rgba(20, 22, 32, 0.15)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.85)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, size, size);

  // Concentric grooves
  ctx.strokeStyle = "rgba(245, 239, 226, 0.07)";
  ctx.lineWidth = 1;
  for (let r = 60; r < size * 0.55; r += 28) {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Compass marks at cardinals
  ctx.strokeStyle = "rgba(232, 116, 59, 0.35)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i += 1) {
    const angle = (i / 4) * Math.PI * 2;
    const x1 = size / 2 + Math.cos(angle) * size * 0.28;
    const y1 = size / 2 + Math.sin(angle) * size * 0.28;
    const x2 = size / 2 + Math.cos(angle) * size * 0.32;
    const y2 = size / 2 + Math.sin(angle) * size * 0.32;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Speckle noise
  const image = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    if (Math.random() < 0.06) {
      const noise = Math.random() * 18;
      image.data[i]     += noise;
      image.data[i + 1] += noise;
      image.data[i + 2] += noise;
    }
  }
  ctx.putImageData(image, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function prefersReducedMotion() {
  return typeof window !== "undefined"
    && window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function makeCosmicFloorMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime:          { value: 0 },
      uReducedMotion: { value: prefersReducedMotion() ? 1.0 : 0.0 },
      uColorWarm:     { value: new THREE.Color(COLORS.amber) },
      uColorMag:      { value: new THREE.Color(0xa14a7f) },
      uColorCool:     { value: new THREE.Color(COLORS.cyan) },
      uColorStar:     { value: new THREE.Color(COLORS.vellum) },
      uCenterFade:    { value: 0.18 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uReducedMotion;
      uniform vec3  uColorWarm;
      uniform vec3  uColorMag;
      uniform vec3  uColorCool;
      uniform vec3  uColorStar;
      uniform float uCenterFade;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 3; i++) {
          v += a * vnoise(p);
          p *= 2.03;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 centered = vUv - 0.5;
        float radial = length(centered);

        float t = mix(uTime, 0.0, uReducedMotion);
        vec2 drift = vec2(t * 0.012, t * -0.008);

        float centerDamp = smoothstep(uCenterFade, uCenterFade + 0.12, radial);
        float outerDamp  = 1.0 - smoothstep(0.46, 0.50, radial);
        float ringMask = centerDamp * outerDamp;

        // Two-octave fbm with mild domain warping
        float n1 = fbm(vUv * 2.8 + drift);
        float n2 = fbm(vUv * 5.4 - drift * 1.4 + n1);
        float raw = mix(n1, n2, 0.55);

        // Layer 1 — diffuse galactic dust: present across most of the disc.
        // Provides the always-on warm/magenta haze.
        float dust = smoothstep(0.28, 0.58, raw);
        dust = pow(dust, 1.4) * ringMask;

        // Layer 2 — discrete blooms: narrow band, steep power. Sits on top of
        // the dust as bright amber pockets.
        float bloom = smoothstep(0.58, 0.72, raw);
        bloom = pow(bloom, 2.5) * ringMask;

        // Combined intensity for color ramp + alpha
        float nebula = clamp(dust * 0.7 + bloom * 0.9, 0.0, 1.0);

        // Color: cool whisper at darkest dust → magenta dominates the mid-range
        // → amber at the bloom cores.
        vec3 nebColor = mix(uColorCool * 0.4, uColorMag, smoothstep(0.0, 0.35, nebula));
        nebColor      = mix(nebColor,        uColorWarm, smoothstep(0.55, 0.85, nebula));

        // Star layer
        vec2  starGrid = floor(vUv * 240.0);
        float starHash = hash(starGrid);
        float starPick = step(0.987, starHash);
        vec2  starCell = fract(vUv * 240.0) - 0.5;
        float starDist = length(starCell);
        float star = starPick * smoothstep(0.18, 0.0, starDist) * ringMask;

        vec3  color = nebColor * nebula * 1.4 + uColorStar * star * 1.0;
        float alpha = clamp(nebula * 1.2 + star, 0.0, 1.0);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });
}

// =================================================================
// PILLARS — ring of marble columns with glowing lamp finials
// =================================================================
function makeFlutedShaft(rTop, rBottom, height, fluteCount = 16, depth = 0.018) {
  const radialSegments = fluteCount * 6;
  const geo = new THREE.CylinderGeometry(rTop, rBottom, height, radialSegments, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-4) continue;
    const theta = Math.atan2(z, x);
    const newR = r - depth * (0.5 - 0.5 * Math.cos(theta * fluteCount));
    pos.setX(i, Math.cos(theta) * newR);
    pos.setZ(i, Math.sin(theta) * newR);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildPillars() {
  const group = new THREE.Group();

  const pillarGeo = makeFlutedShaft(0.32, 0.4, GALLERY.pillarHeight);
  const pillarMat = new THREE.MeshStandardMaterial({
    color: COLORS.pillar,
    roughness: 0.55,
    metalness: 0.05,
  });

  const capGeo = new THREE.BoxGeometry(0.95, 0.18, 0.95);
  const baseGeo = new THREE.BoxGeometry(1.05, 0.24, 1.05);
  const capMat = new THREE.MeshStandardMaterial({
    color: COLORS.pillar,
    roughness: 0.4,
    metalness: 0.12,
  });

  const finialGeo = new THREE.SphereGeometry(0.18, 24, 24);
  const finialMat = new THREE.MeshStandardMaterial({
    color: COLORS.amber2,
    emissive: COLORS.amber,
    emissiveIntensity: 1.4,
    roughness: 0.3,
    metalness: 0.0,
  });

  for (let i = 0; i < GALLERY.pillarCount; i += 1) {
    const angle = (i / GALLERY.pillarCount) * Math.PI * 2;
    const x = Math.cos(angle) * GALLERY.pillarRing;
    const z = Math.sin(angle) * GALLERY.pillarRing;

    const base = new THREE.Mesh(baseGeo, capMat);
    base.position.set(x, 0.12, z);
    group.add(base);

    const shaft = new THREE.Mesh(pillarGeo, pillarMat);
    shaft.position.set(x, GALLERY.pillarHeight / 2 + 0.24, z);
    group.add(shaft);

    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(x, GALLERY.pillarHeight + 0.24 + 0.09, z);
    group.add(cap);

    const finial = new THREE.Mesh(finialGeo, finialMat);
    finial.position.set(x, GALLERY.pillarHeight + 0.5, z);
    group.add(finial);
  }

  return group;
}

// =================================================================
// PLINTH BASE DOTS — museum LED markers tracing the plinth footprint
// =================================================================
function buildPlinthDots() {
  const group = new THREE.Group();

  const dotGeo = new THREE.SphereGeometry(0.045, 12, 8);
  const dotMat = new THREE.MeshStandardMaterial({
    color: COLORS.amber2,
    emissive: COLORS.amber,
    emissiveIntensity: 0.85,
    roughness: 0.4,
    metalness: 0.0,
  });

  const half = 1.28;
  const perSide = 7;
  for (let i = 0; i < perSide; i += 1) {
    const t = -half + (2 * half) * (i / (perSide - 1));
    const n = new THREE.Mesh(dotGeo, dotMat); n.position.set(t, 0.04, -half); group.add(n);
    const s = new THREE.Mesh(dotGeo, dotMat); s.position.set(t, 0.04,  half); group.add(s);
    if (i !== 0 && i !== perSide - 1) {
      const e = new THREE.Mesh(dotGeo, dotMat); e.position.set( half, 0.04, t); group.add(e);
      const w = new THREE.Mesh(dotGeo, dotMat); w.position.set(-half, 0.04, t); group.add(w);
    }
  }

  for (let sx = -1; sx <= 1; sx += 2) {
    for (let sz = -1; sz <= 1; sz += 2) {
      const lamp = new THREE.PointLight(COLORS.amber, 0.32, 2.6, 2.6);
      lamp.position.set(sx * half, 0.18, sz * half);
      group.add(lamp);
    }
  }

  return group;
}

// =================================================================
// CENTRAL EXHIBIT — plinth + suspended APOD frame
// =================================================================
function buildExhibit() {
  const group = new THREE.Group();

  // Plinth
  const plinthGeo = new THREE.BoxGeometry(2.4, 1.05, 2.4);
  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0x1a1c24,
    roughness: 0.35,
    metalness: 0.4,
  });
  const plinth = new THREE.Mesh(plinthGeo, plinthMat);
  plinth.position.y = 0.525;
  group.add(plinth);

  // Plinth top inlay
  const inlay = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.04, 2.2),
    new THREE.MeshStandardMaterial({
      color: COLORS.amber,
      emissive: COLORS.amber,
      emissiveIntensity: 0.3,
      roughness: 0.4,
      metalness: 0.2,
    }),
  );
  inlay.position.y = 1.07;
  group.add(inlay);

  // Frame group — will be re-scaled when texture loads
  const frame = new THREE.Group();
  frame.position.y = 3.6;
  group.add(frame);

  const placeholderTexture = makePlaceholderTexture();

  // Picture plane (front-facing)
  const pictureGeo = new THREE.PlaneGeometry(5.2, 3.5);
  const pictureMat = new THREE.MeshStandardMaterial({
    map: placeholderTexture,
    emissive: 0xffffff,
    emissiveMap: placeholderTexture,
    emissiveIntensity: 0.55,
    roughness: 0.85,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  const picture = new THREE.Mesh(pictureGeo, pictureMat);
  frame.add(picture);

  // Outer bezel — a thin frame around the picture
  const bezelMat = new THREE.MeshStandardMaterial({
    color: 0x0f1117,
    roughness: 0.4,
    metalness: 0.5,
  });
  const bezelThickness = 0.16;
  const bezelDepth = 0.18;
  const bezels = [];
  for (let i = 0; i < 4; i += 1) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, bezelDepth),
      bezelMat,
    );
    frame.add(bar);
    bezels.push(bar);
  }

  // Gilded inner accent
  const accentMat = new THREE.MeshStandardMaterial({
    color: COLORS.amber,
    emissive: COLORS.amber,
    emissiveIntensity: 0.6,
    roughness: 0.4,
    metalness: 0.6,
  });
  const accentThickness = 0.02;
  const accents = [];
  for (let i = 0; i < 4; i += 1) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 0.04),
      accentMat,
    );
    frame.add(bar);
    accents.push(bar);
  }

  function layoutFrame(width, height) {
    picture.scale.set(width / 5.2, height / 3.5, 1);

    const halfW = width / 2;
    const halfH = height / 2;
    const t = bezelThickness;

    // top, bottom, left, right
    bezels[0].scale.set(width + t * 2, t, 1);
    bezels[0].position.set(0, halfH + t / 2, 0.005);
    bezels[1].scale.set(width + t * 2, t, 1);
    bezels[1].position.set(0, -halfH - t / 2, 0.005);
    bezels[2].scale.set(t, height, 1);
    bezels[2].position.set(-halfW - t / 2, 0, 0.005);
    bezels[3].scale.set(t, height, 1);
    bezels[3].position.set(halfW + t / 2, 0, 0.005);

    const at = accentThickness;
    const inset = 0.005;
    accents[0].scale.set(width - inset, at, 1);
    accents[0].position.set(0, halfH - inset, 0.026);
    accents[1].scale.set(width - inset, at, 1);
    accents[1].position.set(0, -halfH + inset, 0.026);
    accents[2].scale.set(at, height - inset, 1);
    accents[2].position.set(-halfW + inset, 0, 0.026);
    accents[3].scale.set(at, height - inset, 1);
    accents[3].position.set(halfW - inset, 0, 0.026);
  }

  layoutFrame(5.2, 3.5);

  function setApod(texture) {
    pictureMat.map = texture;
    pictureMat.emissiveMap = texture;
    pictureMat.needsUpdate = true;

    const image = texture.image;
    const aspect = (image && image.width && image.height)
      ? image.width / image.height
      : 16 / 9;

    // Fit within a target max width / height while preserving aspect.
    const maxW = 6.4;
    const maxH = 4.6;
    let w = maxW;
    let h = w / aspect;
    if (h > maxH) {
      h = maxH;
      w = h * aspect;
    }
    layoutFrame(w, h);
  }

  function update(t) {
    frame.position.y = 3.6 + Math.sin(t * 0.45) * 0.04;
    frame.rotation.y = Math.sin(t * 0.2) * 0.012;
  }

  return {
    group,
    setApod,
    update,
    getInteractAnchor: () => new THREE.Vector3(0, 0.5, 0), // plinth center
  };
}

function makePlaceholderTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");

  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "#1a2238");
  grad.addColorStop(1, "#04060d");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "rgba(232, 116, 59, 0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.32, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "rgba(245, 239, 226, 0.7)";
  ctx.font = "16px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("AWAITING TRANSMISSION", size / 2, size / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// =================================================================
// DUST — drifting motes
// =================================================================
function buildDust() {
  const count = 800;
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * GALLERY.radius * 1.5;
    positions[i * 3]     = Math.cos(angle) * radius;
    positions[i * 3 + 1] = Math.random() * 10;
    positions[i * 3 + 2] = Math.sin(angle) * radius;
    speeds[i] = 0.04 + Math.random() * 0.12;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: COLORS.vellum,
    size: 0.05,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    sizeAttenuation: true,
    map: makeDustSprite(),
    blending: THREE.AdditiveBlending,
    fog: true,
  });

  const points = new THREE.Points(geometry, material);
  let lastT = 0;

  function update(t) {
    const dt = Math.min(0.1, t - lastT);
    lastT = t;
    const pos = geometry.attributes.position.array;
    for (let i = 0; i < count; i += 1) {
      pos[i * 3 + 1] += speeds[i] * dt;
      if (pos[i * 3 + 1] > 10) {
        pos[i * 3 + 1] = -0.5;
      }
    }
    geometry.attributes.position.needsUpdate = true;
  }

  return { points, update };
}

function makeDustSprite() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255, 248, 230, 0.9)");
  grad.addColorStop(0.4, "rgba(255, 240, 200, 0.4)");
  grad.addColorStop(1, "rgba(255, 230, 180, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// =================================================================
// COFFEE MUG — easter-egg interactable on the plinth
// =================================================================
function buildCoffeeMug() {
  const group = new THREE.Group();

  // Ceramic material — pale vellum, slightly creamy. Always carries a
  // faint amber emissive so the easter-egg is findable from a few metres.
  const ceramic = new THREE.MeshStandardMaterial({
    color: 0xf2ead7,
    roughness: 0.45,
    metalness: 0.03,
    emissive: 0xe8743b,
    emissiveIntensity: 0.18,
  });

  // Lathe profile for the mug body (revolved around the Y axis).
  // Units are in meters: ~13cm tall × 8cm wide.
  const profile = [
    new THREE.Vector2(0.000, 0.000),
    new THREE.Vector2(0.038, 0.000),
    new THREE.Vector2(0.040, 0.005),
    new THREE.Vector2(0.040, 0.015),
    new THREE.Vector2(0.044, 0.020),
    new THREE.Vector2(0.046, 0.050),
    new THREE.Vector2(0.046, 0.110),
    new THREE.Vector2(0.044, 0.124),
    new THREE.Vector2(0.044, 0.130), // top outer rim
    new THREE.Vector2(0.039, 0.130), // top inner rim
    new THREE.Vector2(0.039, 0.122),
    new THREE.Vector2(0.040, 0.040), // inner wall
    new THREE.Vector2(0.038, 0.030), // inner base
    new THREE.Vector2(0.000, 0.030),
  ];
  const bodyGeo = new THREE.LatheGeometry(profile, 32);
  const body = new THREE.Mesh(bodyGeo, ceramic);
  group.add(body);

  // Coffee surface — a dark disc set just below the rim
  const coffeeMat = new THREE.MeshStandardMaterial({
    color: 0x261509,
    roughness: 0.25,
    metalness: 0.1,
    emissive: 0x000000,
  });
  const coffee = new THREE.Mesh(
    new THREE.CircleGeometry(0.037, 32),
    coffeeMat,
  );
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 0.120;
  group.add(coffee);

  // Handle — partial torus, oriented so its opening faces outward
  const handleGeo = new THREE.TorusGeometry(0.028, 0.009, 12, 24, Math.PI * 1.1);
  const handle = new THREE.Mesh(handleGeo, ceramic);
  handle.position.set(0.045, 0.075, 0);
  handle.rotation.z = -Math.PI / 2;
  handle.rotation.y = Math.PI / 2;
  group.add(handle);

  // Hit target — a slightly-inflated invisible cylinder for forgiving
  // raycasts; lets the user pick the mug from a generous distance.
  const hitGeo = new THREE.CylinderGeometry(0.075, 0.06, 0.17, 12);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitObject = new THREE.Mesh(hitGeo, hitMat);
  hitObject.position.y = 0.085;
  hitObject.userData.isCoffeeMug = true;
  group.add(hitObject);

  // Idle and hover bookkeeping — rotation base is set by the caller.
  let hoverTarget = 0;
  let hoverNow = 0;
  let baseRotY = 0;
  let baseCaptured = false;
  const inner = new THREE.Group();
  // Re-parent visuals under an inner group so we can rotate it
  // independently of the user-set group orientation.
  inner.add(body);
  inner.add(coffee);
  inner.add(handle);
  group.add(inner);

  function setHover(on) {
    hoverTarget = on ? 1 : 0;
  }

  function update(t) {
    if (!baseCaptured) {
      baseRotY = group.rotation.y;
      baseCaptured = true;
    }
    hoverNow += (hoverTarget - hoverNow) * 0.12;
    // Idle glow + boost when hovered
    ceramic.emissiveIntensity = 0.18 + hoverNow * 0.55;
    coffeeMat.emissive.setHex(hoverNow > 0.5 ? 0x3a1a08 : 0x000000);
    // Idle bob is applied to the inner group so the parent's rotation
    // (the placement angle) stays untouched.
    inner.rotation.y = Math.sin(t * 0.4) * 0.02 + hoverNow * 0.18;
    const scale = 1 + hoverNow * 0.08;
    inner.scale.setScalar(scale);
  }

  return { group, hitObject, setHover, update };
}

// =================================================================
// PUBLIC: load APOD texture into the scene
// =================================================================
export function loadApodTexture(url) {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
        texture.minFilter = THREE.LinearMipMapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        resolve(texture);
      },
      undefined,
      (error) => reject(error),
    );
  });
}
