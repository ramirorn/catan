// Glue between the 3D board scene and the overlays (dice + board animations):
//  · registers the board bridge: board point (SVG units) ↔ screen, and a
//    camera fly-to for the city upgrade;
//  · hosts the dice throw: on the 3D board the dice land on the table where
//    the player is looking and move with the camera like any other piece.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GatedDice } from '../Dice3D/DiceScene';
import { registerDiceHost, setBoardBridge, useSceneDiceThrow } from '../Effects/fxSignal';
import { PX, TILE_H } from './resources';

export function BoardBridge3D({ rig }) {
  const get = useThree((s) => s.get);

  useEffect(() => {
    const v = new THREE.Vector3();
    const w = new THREE.Vector3();
    const right = new THREE.Vector3();
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TILE_H);
    const ndc = new THREE.Vector2();
    const cache = { at: -1, rect: null };
    const rect = (gl) => {
      const now = performance.now();
      if (now - cache.at > 8 || !cache.rect) {
        cache.rect = gl.domElement.getBoundingClientRect();
        cache.at = now;
      }
      return cache.rect;
    };

    const project = (bx, by) => {
      const { camera, gl } = get();
      const r = rect(gl);
      if (!r.width || !r.height) return null;
      camera.updateMatrixWorld();
      v.set(bx * PX, TILE_H, by * PX);
      w.copy(v);
      v.project(camera);
      if (v.z > 1 || v.z < -1) return null;
      // px per board unit at that depth: project a point one unit to the right
      right.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(PX);
      w.add(right).project(camera);
      const s = Math.hypot(((w.x - v.x) / 2) * r.width, ((w.y - v.y) / 2) * r.height);
      return {
        x: r.left + ((v.x + 1) / 2) * r.width,
        y: r.top + ((1 - v.y) / 2) * r.height,
        s,
      };
    };

    const toBoard = (clientX, clientY) => {
      const { camera, gl } = get();
      const r = rect(gl);
      if (!r.width || !r.height) return null;
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.ray.intersectPlane(plane, w);
      return hit ? { x: hit.x / PX, y: hit.z / PX } : null;
    };

    const focus = (bx, by, opts) => rig.current?.focus(new THREE.Vector3(bx * PX, 0, by * PX), opts) ?? (() => {});

    const offBridge = setBoardBridge({ mode: '3d', project, toBoard, focus });
    const offHost = registerDiceHost();
    return () => {
      offBridge();
      offHost();
    };
  }, [get, rig]);

  return <SceneDice />;
}

// Dice size on the board (a die ≈ a third of a hex across)
const DICE_SCALE = 0.55;

function SceneDice() {
  const t = useSceneDiceThrow();
  if (!t) return null;
  return <ThrownDice key={t.id} t={t} />;
}

function ThrownDice({ t }) {
  const get = useThree((s) => s.get);
  const invalidate = useThree((s) => s.invalidate);
  const group = useRef(null);
  const values = useMemo(() => [t.die1, t.die2], [t.die1, t.die2]);

  // Land where the player is looking, thrown from their lower right
  const place = useMemo(() => {
    const { camera, controls } = get();
    const target = controls?.target ?? new THREE.Vector3();
    const yaw = Math.atan2(camera.position.x - target.x, camera.position.z - target.z);
    return { x: target.x, z: target.z, yaw };
    // once per throw
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const outAt = useRef(null);
  useEffect(() => {
    invalidate();
  }, [invalidate]);

  // Keep rendering while the dice are on the table; shrink away at the end
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    if (t.out) {
      if (outAt.current === null) outAt.current = performance.now();
      const k = Math.min(1, (performance.now() - outAt.current) / 320);
      g.scale.setScalar(Math.max(0.001, DICE_SCALE * (1 - k * k)));
      if (k < 1) invalidate();
      return;
    }
    invalidate();
  });

  return (
    <group ref={group} position={[place.x, TILE_H + 0.006, place.z]} rotation-y={place.yaw} scale={DICE_SCALE}>
      {/* no extra light here: adding one would recompile every board material */}
      <GatedDice values={values} seed={t.seed} lowPower={t.lowPower} onStart={t.onStart} onSettled={t.onSettled} onTop />
    </group>
  );
}
