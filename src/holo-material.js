import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import React, { useEffect, useMemo, useState } from "react";
import { useFrame } from "react-three-fiber";
import { RenderPass, SavePass, GlitchEffect, EffectPass } from "postprocessing";
import { usePipeline } from "./store";

class HoloMaterialImpl extends THREE.MeshPhysicalMaterial {
  _glitchDiffuse;
  _time;
  constructor(parameters = {}) {
    super(parameters);
    this.setValues(parameters);
    this._glitchDiffuse = { value: null };
    this._time = { value: null };
  }

  onBeforeCompile(shader) {
    shader.uniforms.glitchDiffuse = this._glitchDiffuse;
    shader.uniforms.time = this._time;

    shader.vertexShader = `
      varying vec3 my_position;
      uniform sampler2D glitchDiffuse;
      ${shader.vertexShader}
    `;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      `
        #include <project_vertex>
        vec4 glitch = texture2D(glitchDiffuse, uv);
        transformed.z += 0.01 * glitch.r;
        my_position = transformed;
        my_position = normalize(my_position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed,1.);
      `
    );

    shader.fragmentShader = `
        uniform sampler2D glitchDiffuse;
        uniform float time;
        varying vec3 my_position;
        ${shader.fragmentShader}
    `;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `
        #include <map_fragment>
        vec2 my_uv = fract(vUv - vec2(0., time));
        vec4 glitch = texture2D(glitchDiffuse, my_uv);
        diffuseColor.r *= 0.2;
        diffuseColor.g *= 0.4;
        diffuseColor.b *= 8.0;
        diffuseColor.a *= smoothstep(0.2,1.0,glitch.r);
        diffuseColor.a *= smoothstep(0.65, 1.0,  my_position.z);
      `
    );
  }

  get glitchDiffuse() {
    return this._glitchDiffuse.value;
  }
  set glitchDiffuse(v) {
    this._glitchDiffuse.value = v;
  }
  get time() {
    return this._time.value;
  }
  set time(v) {
    this._time.value = v;
  }
}

function HoloMaterial(savePass) {
  return React.forwardRef((props, ref) => {
    const [material] = useState(() => new HoloMaterialImpl());
    const [map, depth] = useTexture(["/map.jpg", "/depth.png"]);

    useFrame((state) => {
      if (material) {
        material.time = state.clock.getElapsedTime() / 128;
      }
    });

    return (
      <primitive
        object={material}
        ref={ref}
        attach="material"
        side={THREE.DoubleSide}
        {...props}
        transparent
        transmission={0.2}
        map={map}
        alphaMap={depth}
        displacementMap={depth}
        displacementScale={0.5}
        glitchDiffuse={savePass.renderTarget.texture}
      />
    );
  });
}

export function useHoloMaterial() {
  const setPipeline = usePipeline((s) => s.setPipeline);
  const perturbationMap = useTexture("/perturbation.jpeg");

  const [savePass, pipeline, scene] = useMemo(() => {
    const GLITCH = new GlitchEffect({
      perturbationMap,
      strength: new THREE.Vector2(0.1, 0.1),
    });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    scene.background = new THREE.Color(0xffffff);
    const renderPass = new RenderPass(scene, camera);
    const glitchPass = new EffectPass(camera, GLITCH);
    const savePass = new SavePass(new THREE.WebGLRenderTarget(8, 8));
    return [savePass, [renderPass, glitchPass, savePass], scene];
  }, [perturbationMap]);

  const Material = useMemo(() => HoloMaterial(savePass), [savePass]);

  useEffect(() => setPipeline(pipeline), [pipeline, setPipeline]);

  return [Material, scene];
}
