import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { TextureLoader } from 'three';
import * as THREE from 'three';

const GlobeMesh = () => {
  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    const textureLoader = new TextureLoader();
    textureLoader.load('/img/8k_earth_nightmap.jpg', (texture) => {
      if (meshRef.current) {
        const material = meshRef.current.material as THREE.MeshPhongMaterial;
        material.map = texture;
        material.needsUpdate = true;
      }
    });
  }, []);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.005;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[2, 128, 128]} />
      <meshPhongMaterial
        emissive={0x000000}
        shininess={0}
      />
    </mesh>
  );
};

const StarSky = () => {
  const skyRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    const textureLoader = new TextureLoader();
    textureLoader.load('/img/8k_stars_milky_way.jpg', (texture) => {
      if (skyRef.current) {
        const material = skyRef.current.material as THREE.MeshBasicMaterial;
        material.map = texture;
        material.needsUpdate = true;
      }
    });
  }, []);

  return (
    <mesh ref={skyRef}>
      <sphereGeometry args={[20, 64, 64]} />
      <meshBasicMaterial side={THREE.BackSide} />
    </mesh>
  );
};

export const EarthGlobe = () => {
  return (
    <Canvas
      style={{ width: '100%', height: '100%' }}
      camera={{ position: [0, 0, 5], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
    >
      <StarSky />
      <ambientLight intensity={0.6} />
      <pointLight position={[10, 10, 10]} intensity={1.2} />
      <pointLight position={[-10, -10, 5]} intensity={0.4} color={0x4488ff} />
      <GlobeMesh />
    </Canvas>
  );
};
