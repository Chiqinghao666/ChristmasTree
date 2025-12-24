
import React, { useRef } from 'react';
import { Environment, OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useFrame } from '@react-three/fiber';
import { Foliage } from './Foliage';
import { Ornaments } from './Ornaments';
import { Polaroids } from './Polaroids';
import { TreeStar } from './TreeStar';
import { TreeMode } from '../types';

interface ExperienceProps {
  mode: TreeMode;
  handPosition: { x: number; y: number; detected: boolean };
  uploadedPhotos: string[];
  twoHandsDetected: boolean;
  onClosestPhotoChange?: (photoUrl: string | null) => void;
  selectedPhotoIndex?: number;
  onSelectedPhotoIndexChange?: (index: number) => void;
}

export const Experience: React.FC<ExperienceProps> = ({ mode, handPosition, uploadedPhotos, twoHandsDetected, onClosestPhotoChange, selectedPhotoIndex, onSelectedPhotoIndexChange }) => {
  const controlsRef = useRef<any>(null);

  // Update camera rotation based on hand position
  useFrame((_, delta) => {
    if (controlsRef.current && handPosition.detected) {
      const controls = controlsRef.current;
      
      // Map hand position to spherical coordinates
      // x: 0 (left) to 1 (right) -> azimuthal angle (horizontal rotation)
      // y: 0 (top) to 1 (bottom) -> polar angle (vertical tilt)
      
      // Target azimuthal angle: increased range for larger rotation
      const targetAzimuth = (handPosition.x - 0.5) * Math.PI * 3; // Increased from 2 to 3
      
      // Adjust Y mapping so natural hand position gives best view
      // Offset Y so hand at 0.4-0.5 range gives centered view
      const adjustedY = (handPosition.y - 0.2) * 2.0; // Increased sensitivity from 1.5 to 2.0
      const clampedY = Math.max(0, Math.min(1, adjustedY)); // Clamp to 0-1
      
      // Target polar angle: PI/4 to PI/1.8 (constrained vertical angle)
      const minPolar = Math.PI / 4;
      const maxPolar = Math.PI / 1.8;
      const targetPolar = minPolar + clampedY * (maxPolar - minPolar);
      
      // Get current angles
      const currentAzimuth = controls.getAzimuthalAngle();
      const currentPolar = controls.getPolarAngle();
      
      // Calculate angle differences (handle wrapping for azimuth)
      let azimuthDiff = targetAzimuth - currentAzimuth;
      if (azimuthDiff > Math.PI) azimuthDiff -= Math.PI * 2;
      if (azimuthDiff < -Math.PI) azimuthDiff += Math.PI * 2;
      
      // Smoothly interpolate angles
      const lerpSpeed = 8; // Increased from 5 to 8 for faster response
      const newAzimuth = currentAzimuth + azimuthDiff * delta * lerpSpeed;
      const newPolar = currentPolar + (targetPolar - currentPolar) * delta * lerpSpeed;
      
      // Calculate new camera position in spherical coordinates
      const radius = controls.getDistance();
      const targetY = 4; // Tree center height
      
      const x = radius * Math.sin(newPolar) * Math.sin(newAzimuth);
      const y = targetY + radius * Math.cos(newPolar);
      const z = radius * Math.sin(newPolar) * Math.cos(newAzimuth);
      
      // Update camera position and target
      controls.object.position.set(x, y, z);
      controls.target.set(0, targetY, 0);
      controls.update();
    }
  });
  return (
    <>
      <OrbitControls 
        ref={controlsRef}
        enablePan={false} 
        minPolarAngle={Math.PI / 4} 
        maxPolarAngle={Math.PI / 1.8}
        minDistance={10}
        maxDistance={30}
        enableDamping
        dampingFactor={0.05}
        enabled={true}
      />

      {/* Lighting 奢华祖母绿+金色辉光 */}
      <Environment preset="lobby" background={false} blur={0.65} />
      
      <ambientLight intensity={0.28} color="#0b2e1c" />
      <spotLight 
        position={[10, 20, 10]} 
        angle={0.2} 
        penumbra={1} 
        intensity={2.0} 
        color="#f6e7b2" 
        castShadow 
      />
      <pointLight position={[-10, 5, -10]} intensity={1.2} color="#d2b35a" />
      <pointLight position={[12, 6, 12]} intensity={0.9} color="#1d5f3a" />

      <group position={[0, -4, 0]}>
        {/* 增加叶片与新饰品，让树更饱满更有节日感 */}
        <Foliage mode={mode} count={20000} />
        <Ornaments mode={mode} count={950} />
        <Polaroids 
          mode={mode} 
          uploadedPhotos={uploadedPhotos} 
          twoHandsDetected={twoHandsDetected} 
          onClosestPhotoChange={onClosestPhotoChange}
          selectedIndex={selectedPhotoIndex}
          onSelectedIndexChange={onSelectedPhotoIndexChange}
        />
        <TreeStar mode={mode} />
      </group>

      <EffectComposer enableNormalPass={false}>
        <Bloom 
          luminanceThreshold={0.78} 
          mipmapBlur 
          intensity={1.4} 
          radius={0.6}
        />
        <Vignette eskil={false} offset={0.1} darkness={0.65} />
        <Noise opacity={0.02} blendFunction={BlendFunction.OVERLAY} />
      </EffectComposer>
    </>
  );
};
