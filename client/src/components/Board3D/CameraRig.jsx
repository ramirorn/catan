// Tilted perspective camera over the island with free orbit / pan / zoom,
// damping, and animated zoom-button / reset moves. Renders on demand only.
//
// Panning: the look-at point may roam over the whole island and past its
// edge into the sea frame. Further out it meets a growing resistance (rubber
// band) and, once released, eases back inside: no hard wall over the tiles.

import { useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// Default tilt from vertical: ~48° on landscape screens, flatter (~32°) on
// portrait phones where the island is width-limited anyway
const homePolar = (aspect) => (aspect < 0.85 ? 0.56 : 0.84);
const MIN_POLAR = 0.05;
const MAX_POLAR = 1.22; // ~70°: low enough to admire the island, never below it
const ZOOM_STEP = 1.35;
const MIN_DIST = 0.28; // × fit distance
const MAX_DIST = 1.45;
const PAN_SPEED = 0.9;
// Rubber band past the soft edge (fraction of the ellipse size)
const OVERSHOOT = 0.25;

const ease = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Home view: distance at which every outline point fits (binary search on
 * NDC), with the look-at point nudged toward the viewer so the island is
 * centred on screen despite the perspective (near side looks bigger).
 */
function fitView(points, center, aspect, fov) {
  const POLAR = homePolar(aspect);
  const cam = new THREE.PerspectiveCamera(fov, aspect, 0.1, 500);
  const v = new THREE.Vector3();
  const target = center.clone();
  const place = (d) => {
    cam.position.set(target.x, target.y + d * Math.cos(POLAR), target.z + d * Math.sin(POLAR));
    cam.lookAt(target);
    cam.updateMatrixWorld();
  };
  const range = (d) => {
    place(d);
    let minY = Infinity;
    let maxY = -Infinity;
    let maxX = 0;
    for (const p of points) {
      v.copy(p).project(cam);
      if (v.z > 1) return null;
      minY = Math.min(minY, v.y);
      maxY = Math.max(maxY, v.y);
      maxX = Math.max(maxX, Math.abs(v.x));
    }
    return { minY, maxY, maxX };
  };
  const fits = (d) => {
    const r = range(d);
    return r && r.maxX <= 0.95 && r.maxY <= 0.93 && r.minY >= -0.95;
  };
  let dist = 10;
  for (let pass = 0; pass < 3; pass++) {
    let lo = 1;
    let hi = 200;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    dist = hi;
    const r = range(dist);
    if (!r) break;
    const mid = (r.maxY + r.minY) / 2;
    // screen-y offset → ground distance at the target
    target.z -= mid * dist * Math.tan(THREE.MathUtils.degToRad(fov / 2)) / Math.cos(POLAR);
  }
  return { dist, target, polar: POLAR };
}

export function CameraRig({ rigRef, center, outline, onFlags, touch }) {
  const controls = useRef(null);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const anim = useRef(null);
  // Camera move played for everyone (city upgrade): there and back again
  const cine = useRef(null);
  const moved = useRef(false);
  const flags = useRef({});

  const fov = camera.fov;
  const aspect = size.width / Math.max(1, size.height);
  const view = useMemo(() => fitView(outline, center, aspect, fov), [outline, center, aspect, fov]);
  const fit = view.dist;
  const homeTarget = view.target;
  const POLAR = view.polar;
  const minDist = fit * MIN_DIST;
  const maxDist = fit * MAX_DIST;
  const interacting = useRef(false);

  // Where the look-at point may roam: an ellipse around the island that
  // reaches past the outer tiles and harbours into the sea frame (soft limit,
  // it eases back there once released), plus a rubber-band margin (hard limit)
  const zone = useMemo(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of outline) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
    if (!Number.isFinite(minX)) return { cx: center.x, cz: center.z, ax: 1, az: 1, over: 0.3 };
    // The outline runs ~1 hex past the tiles (harbours); pull it back to the
    // outer tile edges, then ×1.1 so the ellipse also covers the corner
    // hexes and a strip of sea beyond them
    const ax = Math.max(1, ((maxX - minX) / 2 - 0.82) * 1.1);
    const az = Math.max(1, ((maxZ - minZ) / 2 - 0.95) * 1.1);
    return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, ax, az, over: OVERSHOOT };
  }, [outline, center]);

  const homePos = useMemo(
    () => new THREE.Vector3(homeTarget.x, homeTarget.y + fit * Math.cos(POLAR), homeTarget.z + fit * Math.sin(POLAR)),
    [homeTarget, fit, POLAR]
  );

  const pushFlags = () => {
    const c = controls.current;
    if (!c) return;
    const d = camera.position.distanceTo(c.target);
    const next = {
      canZoomIn: d > minDist * 1.02,
      canZoomOut: d < maxDist * 0.98,
      canReset: moved.current,
    };
    const f = flags.current;
    if (f.canZoomIn !== next.canZoomIn || f.canZoomOut !== next.canZoomOut || f.canReset !== next.canReset) {
      flags.current = next;
      onFlags(next);
    }
  };

  // New size / board: refit. If the player has moved the camera, keep their
  // angle and target but scale the distance with the new fit, so resizing the
  // window never leaves the board cropped.
  const prevFit = useRef(fit);
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    if (!moved.current) {
      camera.position.copy(homePos);
      c.target.copy(homeTarget);
    } else if (prevFit.current && prevFit.current !== fit) {
      const offset = camera.position.clone().sub(c.target);
      const d = THREE.MathUtils.clamp(offset.length() * (fit / prevFit.current), fit * MIN_DIST, fit * MAX_DIST);
      camera.position.copy(c.target.clone().add(offset.setLength(d)));
    }
    prevFit.current = fit;
    anim.current = null;
    camera.near = fit * 0.05;
    camera.far = fit * 6;
    camera.updateProjectionMatrix();
    c.update();
    pushFlags();
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homePos, homeTarget, fit]);

  const animateTo = (toPos, toTarget) => {
    const c = controls.current;
    if (!c) return;
    cine.current = null;
    anim.current = {
      fromPos: camera.position.clone(),
      fromTarget: c.target.clone(),
      toPos,
      toTarget,
      t0: performance.now(),
      dur: 420,
    };
    invalidate();
  };

  useImperativeHandle(rigRef, () => ({
    zoomBy(factor) {
      const c = controls.current;
      if (!c) return;
      const offset = camera.position.clone().sub(c.target);
      const d = THREE.MathUtils.clamp(offset.length() * factor, minDist, maxDist);
      moved.current = true;
      animateTo(c.target.clone().add(offset.setLength(d)), c.target.clone());
    },
    zoomIn() {
      this.zoomBy(1 / ZOOM_STEP);
    },
    zoomOut() {
      this.zoomBy(ZOOM_STEP);
    },
    reset() {
      moved.current = false;
      animateTo(homePos.clone(), homeTarget.clone());
    },
    /**
     * Fly to a world point on the board and back to the player's view. Never
     * fights the player: any orbit / pan / zoom (or a button) cancels it and
     * leaves the camera where it is.
     */
    focus(point, { inMs = 450, holdMs = 600, outMs = 450, distK = 0.5 } = {}) {
      const c = controls.current;
      if (!c || interacting.current) return () => {};
      anim.current = null;
      const fromPos = camera.position.clone();
      const fromTarget = c.target.clone();
      const offset = fromPos.clone().sub(fromTarget);
      const toTarget = new THREE.Vector3(point.x, center.y, point.z);
      const d = Math.max(minDist, Math.min(offset.length(), fit * distK));
      const toPos = toTarget.clone().add(offset.setLength(d));
      const token = { fromPos, fromTarget, toPos, toTarget, t0: performance.now(), inMs, holdMs, outMs };
      cine.current = token;
      invalidate();
      return () => {
        if (cine.current === token) cine.current = null;
      };
    },
  }));

  // Where the target sits relative to the soft ellipse: q = 1 on its edge
  const zoneQ = (t) => Math.hypot((t.x - zone.cx) / zone.ax, (t.z - zone.cz) / zone.az);
  // Vector from the target back to the ellipse edge (0 inside)
  const excess = (t, limit = 1) => {
    const q = zoneQ(t);
    if (q <= limit) return { x: 0, z: 0, q };
    const k = 1 - limit / q;
    return { x: (t.x - zone.cx) * k, z: (t.z - zone.cz) * k, q };
  };

  const moveTarget = (dx, dy, dz) => {
    const c = controls.current;
    c.target.x += dx;
    c.target.y += dy;
    c.target.z += dz;
    camera.position.x += dx;
    camera.position.y += dy;
    camera.position.z += dz;
  };

  useFrame(() => {
    const c = controls.current;
    if (!c) return;
    const f = cine.current;
    if (f) {
      const t = performance.now() - f.t0;
      let k = 1;
      if (t < f.inMs) k = easeInOut(t / f.inMs);
      else if (t > f.inMs + f.holdMs) k = 1 - easeInOut(Math.min(1, (t - f.inMs - f.holdMs) / f.outMs));
      camera.position.lerpVectors(f.fromPos, f.toPos, k);
      c.target.lerpVectors(f.fromTarget, f.toTarget, k);
      if (t >= f.inMs + f.holdMs + f.outMs) {
        camera.position.copy(f.fromPos);
        c.target.copy(f.fromTarget);
        cine.current = null;
      }
      c.update();
      invalidate();
      return;
    }
    const a = anim.current;
    if (a) {
      const t = Math.min(1, (performance.now() - a.t0) / a.dur);
      const k = ease(t);
      camera.position.lerpVectors(a.fromPos, a.toPos, k);
      c.target.lerpVectors(a.fromTarget, a.toTarget, k);
      c.update();
      if (t >= 1) {
        anim.current = null;
        pushFlags();
      }
      invalidate();
      return;
    }
    // Released past the frame edge: glide back inside
    if (!interacting.current) {
      const e = excess(c.target);
      if (e.x || e.z) {
        const settle = Math.abs(e.x) < 0.004 && Math.abs(e.z) < 0.004;
        const k = settle ? 1 : 0.14;
        moveTarget(-e.x * k, 0, -e.z * k);
        c.update();
        invalidate();
      }
    }
  });

  // Keep the look-at point on the board plane and within the rubber band
  const onChange = () => {
    const c = controls.current;
    if (!c) return;
    const t = c.target;
    const q = zoneQ(t);
    // Resistance: panning gets slower the further past the soft edge
    const past = Math.max(0, q - 1) / zone.over;
    c.panSpeed = PAN_SPEED * Math.max(0.15, 1 - past) ** 1.5;
    const hard = excess(t, 1 + zone.over);
    const dx = -hard.x;
    const dz = -hard.z;
    if (dx || dz || t.y !== center.y) {
      if (dx || dz) c._panOffset?.set(0, 0, 0); // drop leftover momentum at the wall
      moveTarget(dx, center.y - t.y, dz);
    }
    pushFlags();
  };

  const touches = useMemo(
    () => (touch ? { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE } : { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }),
    [touch]
  );

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.12}
      rotateSpeed={0.55}
      zoomSpeed={0.9}
      panSpeed={PAN_SPEED}
      screenSpacePanning={false}
      zoomToCursor
      minDistance={minDist}
      maxDistance={maxDist}
      minPolarAngle={MIN_POLAR}
      maxPolarAngle={MAX_POLAR}
      touches={touches}
      onStart={() => {
        anim.current = null;
        cine.current = null;
        moved.current = true;
        interacting.current = true;
      }}
      onEnd={() => {
        interacting.current = false;
        invalidate();
      }}
      onChange={onChange}
    />
  );
}
