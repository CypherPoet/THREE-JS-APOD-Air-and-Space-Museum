// =================================================================
// First-person controls: pointer-lock look + WASD walk + mobile drag
// =================================================================

import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

const WALK_SPEED = 3.4;
const RUN_SPEED  = 6.2;
const EYE_HEIGHT = 1.7;

export function attachControls({ camera, renderer, gallery, onInteract, onLockChange }) {
  const controls = new PointerLockControls(camera, renderer.domElement);
  const target = controls.object;
  target.position.set(0, EYE_HEIGHT, 9);

  const keys = new Set();
  const velocity = new THREE.Vector3();
  const direction = new THREE.Vector3();

  let isMobile = matchMedia("(pointer: coarse)").matches;

  // -------- desktop: click to lock --------
  function tryLock() {
    if (controls.isLocked) return;
    controls.lock();
  }
  renderer.domElement.addEventListener("click", () => {
    if (isMobile) return;
    tryLock();
  });

  controls.addEventListener("lock", () => onLockChange?.(true));
  controls.addEventListener("unlock", () => onLockChange?.(false));

  // -------- keyboard --------
  function isTypingInField(event) {
    const t = event.target;
    if (!t) return false;
    const tag = t.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable;
  }

  function onKeyDown(event) {
    if (isTypingInField(event)) return;
    keys.add(event.code);
    if (event.code === "KeyE") {
      onInteract?.();
    }
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // -------- mobile: drag-to-look + auto walk forward --------
  let touchLook = null;
  let mobileForward = false;

  function onTouchStart(event) {
    if (!isMobile) return;
    const touch = event.changedTouches[0];
    touchLook = {
      id: touch.identifier,
      x: touch.clientX,
      y: touch.clientY,
      startTime: performance.now(),
    };
  }

  function onTouchMove(event) {
    if (!touchLook) return;
    const touch = [...event.changedTouches].find(t => t.identifier === touchLook.id);
    if (!touch) return;
    event.preventDefault();
    const dx = touch.clientX - touchLook.x;
    const dy = touch.clientY - touchLook.y;
    touchLook.x = touch.clientX;
    touchLook.y = touch.clientY;

    const euler = new THREE.Euler(0, 0, 0, "YXZ");
    euler.setFromQuaternion(target.quaternion);
    euler.y -= dx * 0.0035;
    euler.x -= dy * 0.0035;
    const half = Math.PI / 2 - 0.05;
    euler.x = Math.max(-half, Math.min(half, euler.x));
    target.quaternion.setFromEuler(euler);
  }

  function onTouchEnd(event) {
    if (!touchLook) return;
    const touch = [...event.changedTouches].find(t => t.identifier === touchLook.id);
    if (!touch) return;
    const dt = performance.now() - touchLook.startTime;
    const dx = touch.clientX - touchLook.x;
    const dy = touch.clientY - touchLook.y;
    // A short tap toggles "walk forward" mode
    if (dt < 220 && Math.abs(dx) < 6 && Math.abs(dy) < 6) {
      mobileForward = !mobileForward;
    }
    touchLook = null;
  }

  renderer.domElement.addEventListener("touchstart", onTouchStart, { passive: true });
  renderer.domElement.addEventListener("touchmove", onTouchMove, { passive: false });
  renderer.domElement.addEventListener("touchend", onTouchEnd);
  renderer.domElement.addEventListener("touchcancel", onTouchEnd);

  // -------- update loop --------
  let lastT = performance.now();
  function update() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;

    const forward = keys.has("KeyW") || keys.has("ArrowUp") || mobileForward;
    const back    = keys.has("KeyS") || keys.has("ArrowDown");
    const left    = keys.has("KeyA") || keys.has("ArrowLeft");
    const right   = keys.has("KeyD") || keys.has("ArrowRight");
    const sprint  = keys.has("ShiftLeft") || keys.has("ShiftRight");

    direction.set(
      Number(right) - Number(left),
      0,
      Number(back) - Number(forward),
    );
    if (direction.lengthSq() > 0) direction.normalize();

    const speed = sprint ? RUN_SPEED : WALK_SPEED;
    velocity.x = direction.x * speed;
    velocity.z = direction.z * speed;

    // Apply movement only when active (locked on desktop, always on mobile)
    const active = controls.isLocked || isMobile;
    if (active && direction.lengthSq() > 0) {
      controls.moveRight(velocity.x * dt);
      controls.moveForward(-velocity.z * dt);
    }

    // Keep camera inside the gallery
    const pos = target.position;
    pos.y = EYE_HEIGHT;
    const r = Math.hypot(pos.x, pos.z);
    const maxR = gallery.radius - 0.6;
    if (r > maxR) {
      const k = maxR / r;
      pos.x *= k;
      pos.z *= k;
    }

    // Push the camera out of the central plinth (2.4m square)
    const plinthHalf = 1.4;
    if (Math.abs(pos.x) < plinthHalf && Math.abs(pos.z) < plinthHalf) {
      // Push toward the nearest edge
      const dx = plinthHalf - Math.abs(pos.x);
      const dz = plinthHalf - Math.abs(pos.z);
      if (dx < dz) {
        pos.x = Math.sign(pos.x || 1) * plinthHalf;
      } else {
        pos.z = Math.sign(pos.z || 1) * plinthHalf;
      }
    }

    // Push around each pillar
    const pillarRing = 10.5;
    const pillarCount = 8;
    const pillarHalf = 0.6;
    for (let i = 0; i < pillarCount; i += 1) {
      const angle = (i / pillarCount) * Math.PI * 2;
      const px = Math.cos(angle) * pillarRing;
      const pz = Math.sin(angle) * pillarRing;
      const ddx = pos.x - px;
      const ddz = pos.z - pz;
      const dist = Math.hypot(ddx, ddz);
      if (dist < pillarHalf) {
        const push = pillarHalf / dist;
        pos.x = px + ddx * push;
        pos.z = pz + ddz * push;
      }
    }
  }

  function isNearExhibit() {
    const pos = target.position;
    return Math.hypot(pos.x, pos.z) < 4.2;
  }

  return {
    controls,
    update,
    isNearExhibit,
    tryLock,
    get isMobile() { return isMobile; },
  };
}
