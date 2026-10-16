// Links every shader of an R3F scene in the background before an animation
// starts (lazy chunks only: imports R3F).

import { useLayoutEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';

/**
 * Shaders of everything in the scene (hidden parts included) are linked in
 * the background first (KHR_parallel_shader_compile where available); until
 * then nothing is drawn and the clock does not run, so no frame of the
 * animation itself ever stalls on a shader.
 */
export function useShadersReady() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    let alive = true;
    const done = () => {
      if (alive) setReady(true);
    };
    try {
      if (gl.compileAsync) gl.compileAsync(scene, camera).then(done, done);
      else {
        gl.compile(scene, camera);
        done();
      }
    } catch {
      done();
    }
    // a driver that never answers must not hold the animation back
    const cap = setTimeout(done, 700);
    return () => {
      alive = false;
      clearTimeout(cap);
    };
  }, [gl, scene, camera]);
  return ready;
}

