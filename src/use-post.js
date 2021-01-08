import { useFrame, useThree } from "react-three-fiber";
import * as THREE from "three";
import { useEffect, useMemo } from "react";
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  ChromaticAberrationEffect,
} from "postprocessing";
import { usePipeline } from "./store";

function usePostprocessing(scene, camera) {
  const { gl, size } = useThree();
  const pipeline = usePipeline((s) => s.pipeline);

  const [composer] = useMemo(() => {
    const composer = new EffectComposer(gl, {
      frameBufferType: THREE.HalfFloatType,
      multisampling: 0,
    });
    const BLOOM = new BloomEffect({
      luminanceThreshold: 0.05,
      luminanceSmoothing: 0.01,
    });
    const CHROMATIC_ABERRATION = new ChromaticAberrationEffect({
      offset: new THREE.Vector2(0.003, 0.003),
    });

    const renderPass = new RenderPass(scene, camera);
    const effectPass = new EffectPass(camera, BLOOM);
    const effectPass2 = new EffectPass(camera, CHROMATIC_ABERRATION);

    pipeline.forEach((x) => composer.addPass(x));
    composer.addPass(renderPass);
    composer.addPass(effectPass);
    composer.addPass(effectPass2);
    return [composer];
  }, [gl, scene, camera, pipeline]);

  useEffect(() => void composer.setSize(size.width, size.height), [
    composer,
    size,
  ]);
  useFrame((_, delta) => void composer.render(delta), -1);
}

export default usePostprocessing;
