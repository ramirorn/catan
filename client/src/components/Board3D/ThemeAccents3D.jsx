// Board-theme decorations on the 3D sea (stars, dunes, mist, river stones,
// cherry petals): one or two InstancedMeshes per theme, built once per map
// and disposed on unmount. Static: they never ask for extra frames.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { boardTheme, seaSpots, seeded } from '../../utils/cosmetics';
import { PX } from './resources';

function buildAccent(kind) {
  switch (kind) {
    case 'stars':
      return [
        {
          geo: new THREE.OctahedronGeometry(0.06, 0).scale(1, 0.25, 1),
          mat: new THREE.MeshBasicMaterial({ color: '#f4e9b8', transparent: true, opacity: 0.9 }),
          per: 2,
          place: (p, k, rand, o) => {
            o.position.set(p.x + (k ? (rand() - 0.5) * 0.4 : 0), 0.02, p.z + (k ? (rand() - 0.5) * 0.4 : 0));
            o.scale.setScalar(k ? 0.55 : p.s * 1.1);
            o.rotation.y = p.a;
          },
        },
      ];
    case 'dunes':
      return [
        {
          geo: new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
          mat: new THREE.MeshLambertMaterial({ color: '#c99f62' }),
          per: 1,
          place: (p, k, rand, o) => {
            o.position.set(p.x, 0, p.z);
            o.scale.set(0.42 * p.s, 0.05, 0.16 * p.s);
            o.rotation.y = p.a;
          },
        },
      ];
    case 'mist':
      return [
        {
          geo: new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2),
          mat: new THREE.MeshBasicMaterial({ color: '#eef3f6', transparent: true, opacity: 0.2, depthWrite: false }),
          per: 2,
          place: (p, k, rand, o) => {
            o.position.set(p.x + k * 0.15, 0.12 + k * 0.1, p.z + k * 0.1);
            o.scale.set(0.5 * p.s, 1, 0.12);
            o.rotation.y = p.a * 0.2;
          },
        },
      ];
    case 'falls':
      return [
        {
          geo: new THREE.DodecahedronGeometry(0.12, 0).scale(1, 0.6, 1),
          mat: new THREE.MeshLambertMaterial({ color: '#8c8778', flatShading: true }),
          per: 2,
          place: (p, k, rand, o) => {
            o.position.set(p.x + (k ? 0.16 : 0), 0.02, p.z + (k ? 0.08 : 0));
            o.scale.setScalar(k ? 0.6 : p.s);
            o.rotation.set(rand(), p.a, rand() * 0.3);
          },
        },
        {
          geo: new THREE.RingGeometry(0.12, 0.2, 20).rotateX(-Math.PI / 2),
          mat: new THREE.MeshBasicMaterial({ color: '#eef6f2', transparent: true, opacity: 0.45, depthWrite: false }),
          per: 1,
          place: (p, k, rand, o) => {
            o.position.set(p.x, 0.012, p.z);
            o.scale.setScalar(p.s);
          },
        },
      ];
    case 'petals':
      return [
        {
          geo: new THREE.CircleGeometry(1, 10).rotateX(-Math.PI / 2),
          mat: new THREE.MeshLambertMaterial({ color: '#f6b6c8', side: THREE.DoubleSide }),
          per: 4,
          place: (p, k, rand, o) => {
            o.position.set(p.x + (rand() - 0.5) * 0.45, 0.012 + rand() * 0.02, p.z + (rand() - 0.5) * 0.45);
            o.scale.set(0.055, 1, 0.032);
            o.rotation.set((rand() - 0.5) * 0.4, rand() * Math.PI * 2, (rand() - 0.5) * 0.4);
          },
        },
      ];
    default:
      return [];
  }
}

function AccentLayer({ layer, spots }) {
  const ref = useRef(null);
  const count = spots.length * layer.per;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new THREE.Object3D();
    const rand = seeded(count * 31 + 7);
    let i = 0;
    for (const p of spots) {
      for (let k = 0; k < layer.per; k++) {
        o.position.set(0, 0, 0);
        o.rotation.set(0, 0, 0);
        o.scale.set(1, 1, 1);
        layer.place(p, k, rand, o);
        o.updateMatrix();
        mesh.setMatrixAt(i++, o.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [layer, spots, count]);
  if (!count) return null;
  return <instancedMesh ref={ref} args={[layer.geo, layer.mat, count]} renderOrder={-1} receiveShadow={false} />;
}

/** `hexes` = [{ x, y }] in board px */
export function ThemeAccents3D({ themeId, hexes }) {
  const kind = boardTheme(themeId).accent;
  const layers = useMemo(() => buildAccent(kind), [kind]);
  useEffect(
    () => () => {
      for (const l of layers) {
        l.geo.dispose();
        l.mat.dispose();
      }
    },
    [layers]
  );
  const spots = useMemo(
    () => (kind ? seaSpots(hexes).map((p) => ({ ...p, x: p.x * PX, z: p.y * PX })) : []),
    [kind, hexes]
  );
  if (!layers.length || !spots.length) return null;
  return layers.map((layer, i) => <AccentLayer key={`${kind}-${i}`} layer={layer} spots={spots} />);
}
