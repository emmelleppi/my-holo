import React, {
  useRef,
  useMemo,
  useState,
  Suspense,
  useCallback,
  useEffect,
} from "react";
import ReactDOM from "react-dom";
import * as THREE from "three";
import { DeviceOrientationControls } from "three/examples/jsm/controls/DeviceOrientationControls";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";
import {
  Canvas,
  createPortal,
  useFrame,
  useLoader,
  useThree,
} from "react-three-fiber";
import { Plane, Box, Text, Loader, useTexture } from "@react-three/drei";
import clamp from "lodash.clamp";
import usePostprocessing from "./use-post";
import { useHoloMaterial } from "./holo-material";
import { betaRef, gammaRef, isMobile, rotation } from "./store";
import "./styles.css";

function Mouse({ width, height }) {
  const { viewport } = useThree();
  const vec = new THREE.Vector3();
  return useFrame((state) => {
    betaRef.current = -clamp(
      state.mouse.y * viewport.height * 200,
      -45 * height,
      45 * height
    );
    gammaRef.current = -clamp(
      state.mouse.x * viewport.width * 200,
      -45 * width,
      45 * width
    );
    state.camera.lookAt(0, 0, 0);
    state.camera.position.lerp(
      vec.set(
        gammaRef.current / 120,
        betaRef.current / 120,
        1 -
          0.5 *
            Math.min(
              Math.abs(state.camera.position.x) +
                Math.abs(state.camera.position.y),
              1
            )
      ),
      0.1
    );
  });
}

function Boxes({ width, height }) {
  const materialProps = {
    roughness: 1,
    metalness: 0,
    side: THREE.BackSide,
    color: "black",
  };
  const holo = useTexture("/holo.jpg");
  const [HoloMaterial, targetScene] = useHoloMaterial();
  useEffect(() => {
    holo.wrapS = holo.wrapT = THREE.RepeatWrapping;
    holo.repeat.set(1, 4);
  }, [holo]);
  return (
    <group>
      {createPortal(
        <Plane args={[5, 5]} position={[0, 0, -5]} material-map={holo}></Plane>,
        targetScene
      )}
      <Box args={[width, height, 1]}>
        <meshStandardMaterial {...materialProps} attachArray="material" />
        <meshStandardMaterial {...materialProps} attachArray="material" />
        <meshStandardMaterial {...materialProps} attachArray="material" />
        <meshStandardMaterial {...materialProps} attachArray="material" />
        <meshStandardMaterial
          transparent
          opacity={0}
          side={THREE.BackSide}
          attachArray="material"
        />
        <meshStandardMaterial {...materialProps} attachArray="material" />
      </Box>
      <Plane args={[width, height, 256, 256]} position={[0, 0, -0.55]}>
        <HoloMaterial metalness={0} roughness={1} fog={false} />
      </Plane>
    </group>
  );
}

function DepthCube({ width, height }) {
  return (
    <group>
      <Suspense fallback={null}>
        <Boxes width={width} height={height} />
      </Suspense>
      {!isMobile && <Mouse width={width} height={height} />}
      <ambientLight intensity={1} />
      <spotLight
        color="mediumblue"
        penumbra={1}
        angle={Math.PI / 2}
        distance={3}
        position={[0, -0, 0.5]}
        intensity={30}
        castShadow
      />
    </group>
  );
}

function PlanePortal({ width, height }) {
  const planeRef = useRef();
  const [camera] = useState(() => new THREE.PerspectiveCamera());
  const { gl } = useThree();
  const result = useLoader(RGBELoader, "/studio_small_02_1k.hdr");

  const {
    near,
    scene,
    target,
    portalHalfWidth,
    portalHalfHeight,
  } = useMemo(() => {
    const target = new THREE.WebGLRenderTarget();
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x000000, 0, 2);
    scene.background = new THREE.Color("#000000");
    const near = 0.1;
    const portalHalfWidth = width / 2;
    const portalHalfHeight = height / 2;
    return { near, scene, target, portalHalfWidth, portalHalfHeight };
  }, [width, height]);

  usePostprocessing(scene, camera);

  useEffect(() => {
    const gen = new THREE.PMREMGenerator(gl);
    const texture = gen.fromEquirectangular(result).texture;
    scene.environment = texture;
    result.dispose();
    gen.dispose();
    return () => {
      scene.environment = scene.background = null;
    };
  }, [gl, result, scene]);

  useFrame((state) => {
    camera.position.copy(state.camera.position);
    camera.quaternion.copy(planeRef.current.quaternion);
    const portalPosition = new THREE.Vector3().copy(planeRef.current.position);
    camera.updateMatrixWorld();
    camera.worldToLocal(portalPosition);
    const left = portalPosition.x - portalHalfWidth;
    const right = portalPosition.x + portalHalfWidth;
    const top = portalPosition.y + portalHalfHeight;
    const bottom = portalPosition.y - portalHalfHeight;
    const distance = Math.abs(portalPosition.z);
    const scale = near / distance;
    const scaledLeft = left * scale;
    const scaledRight = right * scale;
    const scaledTop = top * scale;
    const scaledBottom = bottom * scale;
    camera.projectionMatrix.makePerspective(
      scaledLeft,
      scaledRight,
      scaledTop,
      scaledBottom,
      near,
      100
    );
  }, 1);
  return (
    <>
      {createPortal(<DepthCube width={width} height={height} />, scene)}
      <Plane ref={planeRef}>
        <meshBasicMaterial map={target.texture} />
      </Plane>
    </>
  );
}

function InteractionManager() {
  const [clicked, setClicked] = useState(false);
  const { aspect } = useThree();
  const { width, height } = useMemo(
    () => ({
      width: aspect > 1 ? 1 : aspect,
      height: aspect > 1 ? 1 / aspect : 1,
    }),
    [aspect]
  );
  const handleClick = useCallback(
    function handleClick() {
      setClicked(true);
      rotation.current = new DeviceOrientationControls(
        new THREE.PerspectiveCamera()
      );
    },
    [setClicked]
  );
  useFrame(({ camera }) => {
    if (!rotation.current) return;
    rotation.current.update();
    if (!rotation.current?.deviceOrientation) return;
    const { beta, gamma } = rotation.current.deviceOrientation;
    if (!beta || !gamma) return;
    betaRef.current = clamp(beta, -45 * height, 45 * height);
    gammaRef.current = clamp(gamma, -45 * width, 45 * width);
    camera.lookAt(0, 0, 0);
    camera.position.x = -gammaRef.current / 90;
    camera.position.y = betaRef.current / 90;
    camera.position.z =
      1 -
      0.5 *
        Math.min(Math.abs(camera.position.x) + Math.abs(camera.position.y), 1);
  });
  return clicked ? (
    <Suspense fallback={null}>
      <PlanePortal width={width} height={height} />
    </Suspense>
  ) : (
    <Text
      onClick={handleClick}
      position={[0, 0, -0.1]}
      rotation-z={Math.PI / 16}
      fontSize={0.2}
      color="white"
      font="https://fonts.gstatic.com/s/fredokaone/v8/k3kUo8kEI-tA1RRcTZGmTlHGCaE.woff"
    >
      Click pls
    </Text>
  );
}

function App() {
  return (
    <>
      <Canvas
        concurrent
        pixelRatio={[1, 1.5]}
        camera={{ position: [0, 0, 1], far: 10, near: 0.1 }}
        gl={{ powerPreference: "high-performance" }}
      >
        <color attach="background" args={["black"]} />
        <InteractionManager />
      </Canvas>
      <Loader />
    </>
  );
}

ReactDOM.render(<App />, document.getElementById("root"));
