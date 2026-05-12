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

  // ---------- DUST ----------
  const dust = buildDust();
  scene.add(dust.points);

  // ---------- LIGHTING ----------
  const ambient = new THREE.HemisphereLight(0x556080, 0x101018, 0.55);
  scene.add(ambient);

  const moonKey = new THREE.DirectionalLight(0xb8c8e0, 0.45);
  moonKey.position.set(-8, 14, 6);
  scene.add(moonKey);

  const amberRim = new THREE.PointLight(COLORS.amber, 1.4, 22, 1.6);
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

    // Pulse the amber rim light gently
    amberRim.intensity = 1.2 + Math.sin(elapsed * 0.6) * 0.18;

    renderer.render(scene, camera);
  }

  return {
    renderer,
    scene,
    camera,
    update,
    exhibit, // { setApod(texture), getInteractAnchor() }
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
      emissiveIntensity: 0.35,
      roughness: 0.7,
      metalness: 0.2,
    }),
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.01;
  group.add(rim);

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

// =================================================================
// PILLARS — ring of marble columns with glowing lamp finials
// =================================================================
function buildPillars() {
  const group = new THREE.Group();

  const pillarGeo = new THREE.CylinderGeometry(0.32, 0.4, GALLERY.pillarHeight, 24);
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
