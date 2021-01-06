import React, {
  useRef,
  useMemo,
  createRef,
  useState,
  Suspense,
  useCallback,
  useEffect,
} from "react";
import ReactDOM from "react-dom";
import * as THREE from "three";
import {
  Canvas,
  createPortal,
  useFrame,
  useLoader,
  useThree,
} from "react-three-fiber";
import {
  Plane,
  Box,
  useNormalTexture,
  Text,
  Loader,
  useTexture,
  Html,
} from "@react-three/drei";
import clamp from "lodash.clamp";
import "./styles.css";
import { DeviceOrientationControls } from "three/examples/jsm/controls/DeviceOrientationControls";
import usePostprocessing from "./use-post";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";

const betaRef = createRef(0);
const gammaRef = createRef(0);
const rotation = createRef();
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

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
  const [normal] = useNormalTexture(75, { repeat: [2, 2] });
  const [map, depth] = useTexture(["/lol.jpg", "/depth.png"]);
  const materialProps = {
    normalScale: [0.3, 0.3],
    normalMap: normal,
    roughness: 0.3,
    metalness: 0.2,
    clearcoat: 0.2,
    side: THREE.BackSide,
    color: "red",
  };

  return (
    <group>
      <Box receiveShadow args={[width, height, 1]}>
        <meshPhysicalMaterial {...materialProps} attachArray="material" />
        <meshPhysicalMaterial {...materialProps} attachArray="material" />
        <meshPhysicalMaterial {...materialProps} attachArray="material" />
        <meshPhysicalMaterial {...materialProps} attachArray="material" />
        <meshPhysicalMaterial
          transparent
          opacity={0}
          side={THREE.BackSide}
          attachArray="material"
        />
        <meshPhysicalMaterial {...materialProps} attachArray="material" />
      </Box>
      <Plane
        castShadow
        args={[width, height, 1024, 1024]}
        position={[0, 0, -0.5]}
      >
        <meshStandardMaterial
          metalness={0.7}
          roughness={0.8}
          map={map}
          alphaMap={depth}
          displacementMap={depth}
          displacementBias={0}
          displacementScale={0.4}
          fog={false}
          alphaTest={0.5}
        />
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
      <ambientLight intensity={0.5} />
      <spotLight
        color="antiquewhite"
        position={[0.5, 0.5, 0]}
        intensity={2}
        angle={Math.PI / 3}
        castShadow
        distance={1}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        penumbra={1}
      />
    </group>
  );
}

function PlanePortal({ width, height }) {
  const planeRef = useRef();
  const [camera] = useState(new THREE.PerspectiveCamera());
  const { gl } = useThree();

  const {
    near,
    scene,
    target,
    portalHalfWidth,
    portalHalfHeight,
  } = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(1024, 1024);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x000000, 0, 2);
    scene.background = new THREE.Color("0x000000");
    const near = 0.1;
    const portalHalfWidth = width / 2;
    const portalHalfHeight = height / 2;
    return { near, scene, target, portalHalfWidth, portalHalfHeight };
  }, [width, height]);

  usePostprocessing(scene, camera);

  const result = useLoader(RGBELoader, "/studio_small_02_1k.hdr");

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
        <meshStandardMaterial attach="material" map={target.texture} />
      </Plane>
    </>
  );
}

function InteractionManager() {
  const { aspect } = useThree();
  const { width, height } = useMemo(
    () =>
      aspect > 1
        ? {
            width: 1,
            height: 1 / aspect,
          }
        : {
            width: aspect,
            height: 1,
          },

    [aspect]
  );
  const [clicked, setClicked] = useState(false);
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
      Clicca zi
    </Text>
  );
}

function App() {
  return (
    <>
      <Canvas
        shadowMap
        concurrent
        camera={{ position: [0, 0, 1], far: 100, near: 0.1 }}
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
