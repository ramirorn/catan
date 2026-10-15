// Tilted perspective camera over the island with limited orbit / pan / zoom,
// damping, and animated zoom-button / reset moves. Renders on demand only.

import { useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// Default tilt from vertical: ~48° on landscape screens, flatter (~32°) on
// portrait phones where the island is width-limited anyway
const homePolar = (aspect) => (aspect < 0.85 ? 0.56 : 0.84);
const MIN_POLAR = 0.12;
const MAX_POLAR = 1.08;
const AZIMUTH_LIMIT = 1.15; // ±66° of rotation around the island
const ZOOM_STEP = 1.35;

const ease = (t) => 1 - Math.pow(1 - t, 3);

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

export function CameraRig({ rigRef, center, outline, extent, onFlags, touch }) {
  const controls = useRef(null);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const anim = useRef(null);
  const moved = useRef(false);
  const flags = useRef({});

  const fov = camera.fov;
  const aspect = size.width / Math.max(1, size.height);
  const view = useMemo(() => fitView(outline, center, aspect, fov), [outline, center, aspect, fov]);
  const fit = view.dist;
  const homeTarget = view.target;
  const POLAR = view.polar;
  const minDist = fit * 0.32;
  const maxDist = fit * 1.3;

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
      const d = THREE.MathUtils.clamp(offset.length() * (fit / prevFit.current), fit * 0.32, fit * 1.3);
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
  }));

  useFrame(() => {
    const a = anim.current;
    const c = controls.current;
    if (!a || !c) return;
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
  });

  // Keep the look-at point over the island while panning
  const onChange = () => {
    const c = controls.current;
    if (!c) return;
    const t = c.target;
    const cx = THREE.MathUtils.clamp(t.x, center.x - extent.x, center.x + extent.x);
    const cz = THREE.MathUtils.clamp(t.z, center.z - extent.z, center.z + extent.z);
    if (cx !== t.x || cz !== t.z || t.y !== center.y) {
      const dx = cx - t.x;
      const dz = cz - t.z;
      const dy = center.y - t.y;
      t.set(cx, center.y, cz);
      camera.position.x += dx;
      camera.position.y += dy;
      camera.position.z += dz;
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
      panSpeed={0.9}
      screenSpacePanning={false}
      minDistance={minDist}
      maxDistance={maxDist}
      minPolarAngle={MIN_POLAR}
      maxPolarAngle={MAX_POLAR}
      minAzimuthAngle={-AZIMUTH_LIMIT}
      maxAzimuthAngle={AZIMUTH_LIMIT}
      touches={touches}
      onStart={() => {
        anim.current = null;
        moved.current = true;
      }}
      onChange={onChange}
    />
  );
}
