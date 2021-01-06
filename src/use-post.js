import { useFrame, useThree, useLoader } from "react-three-fiber";
import * as THREE from "three";
import { useEffect, useMemo } from "react";
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  BlendFunction,
  OverrideMaterialManager,
  ChromaticAberrationEffect,
  NoiseEffect,
} from "postprocessing";

function usePostprocessing(scene, camera) {
  const { gl, size } = useThree();

  const [composer] = useMemo(() => {
    OverrideMaterialManager.workaroundEnabled = true;
    const composer = new EffectComposer(gl, {
      frameBufferType: THREE.HalfFloatType,
      multisampling: 0,
    });
    const renderPass = new RenderPass(scene, camera);

    const BLOOM = new BloomEffect({
      luminanceThreshold: 0.9,
      luminanceSmoothing: 0.5,
    });
    const CHROMATIC_ABERRATION = new ChromaticAberrationEffect({
      offset: new THREE.Vector2(0.001, 0.001),
    });
    const NOISE = new NoiseEffect({
      blendFunction: BlendFunction.COLOR_DODGE,
    });
    NOISE.blendMode.opacity.value = 0.05;

    const effectPass = new EffectPass(camera, BLOOM, NOISE);
    const effectPass2 = new EffectPass(camera, CHROMATIC_ABERRATION);
    composer.addPass(renderPass);
    composer.addPass(effectPass);
    composer.addPass(effectPass2);
    return [composer];
  }, [gl, scene, camera]);

  useEffect(() => void composer.setSize(size.width, size.height), [
    composer,
    size,
  ]);
  useFrame((_, delta) => void composer.render(delta), 1);
}

export default usePostprocessing;
