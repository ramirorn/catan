import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { buildFaceGeometry } from './faceGeometry';

// The back of the head: half an ellipsoid, open towards the face, as deep as
// this fraction of the face's width
const HOOD_DEPTH = 0.6;
// Hood rim a touch inside the mask, so no gap shows at its edge
const HOOD_INSET = 0.03;

/**
 * The 3D face of «Cara del ladrón» (inside a react-three-fiber canvas): the
 * landmark mesh with the photo on it, `width` units wide, looking at +z.
 * With `hoodMaterial` a hood the size of this face closes the head behind it,
 * so from the side it reads as one head and not a floating mask.
 */
export function FaceMask3D({ face, width = 0.13, lit = true, hoodMaterial = null, ...props }) {
  const invalidate = useThree((s) => s.invalidate);
  const geometry = useMemo(() => buildFaceGeometry(face.points), [face.points]);
  const material = useMemo(() => {
    const texture = new THREE.TextureLoader().load(face.image, () => invalidate());
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    // vertexColors: the outline of the face fades into the dark hood
    const opts = { map: texture, side: THREE.DoubleSide, vertexColors: true };
    return lit ? new THREE.MeshLambertMaterial(opts) : new THREE.MeshBasicMaterial(opts);
  }, [face.image, lit, invalidate]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(
    () => () => {
      material.map?.dispose();
      material.dispose();
    },
    [material]
  );

  const aspect = geometry.userData.aspect || 1.25;
  return (
    <group scale={width} {...props}>
      <mesh geometry={geometry} material={material} />
      {hoodMaterial && (
        <mesh material={hoodMaterial} position-z={HOOD_INSET} scale={[0.5 - HOOD_INSET, aspect / 2 - HOOD_INSET, HOOD_DEPTH]}>
          {/* phi π…2π: the half of the sphere behind the face (z ≤ 0) */}
          <sphereGeometry args={[1, 28, 18, Math.PI, Math.PI]} />
        </mesh>
      )}
    </group>
  );
}
