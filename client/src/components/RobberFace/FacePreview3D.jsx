import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FaceMask3D } from './FaceMask3D';

function Turning({ face }) {
  const ref = useRef(null);
  // Same dark hood as on the robber
  const hood = useMemo(() => new THREE.MeshLambertMaterial({ color: '#1c1c22' }), []);
  useFrame(({ clock }) => {
    // Swings from one side to the other, so the depth of the face shows
    if (ref.current) ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.9) * 0.6;
  });
  return (
    <group ref={ref}>
      <FaceMask3D face={face} width={1} position-z={-0.1} hoodMaterial={hood} />
    </group>
  );
}

/** «Así se verá»: the 3D face turning slowly (lazy chunk with the dialog) */
export default function FacePreview3D({ face }) {
  return (
    <Canvas camera={{ position: [0, 0, 2.3], fov: 35 }} dpr={[1, 2]} gl={{ alpha: true, antialias: true }}>
      <ambientLight intensity={1.4} />
      <directionalLight position={[1.2, 1.5, 2.5]} intensity={2.2} />
      <Turning face={face} />
    </Canvas>
  );
}
