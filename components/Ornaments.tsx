import React, { useMemo, useRef, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TreeMode } from '../types';

interface OrnamentsProps {
  mode: TreeMode;
  count: number;
}

// 彩球权重最高，灯光次之，礼物盒最少；保留袜子/姜饼点缀
type OrnamentType = 'ball' | 'gift' | 'light' | 'stocking' | 'gingerbread';

interface InstanceData {
  chaosPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  type: OrnamentType;
  color: THREE.Color;
  scale: number;
  speed: number;
  rotationOffset: THREE.Euler;
}

export const Ornaments: React.FC<OrnamentsProps> = ({ mode, count }) => {
  const ballsRef = useRef<THREE.InstancedMesh>(null);
  const giftsRef = useRef<THREE.InstancedMesh>(null);
  const ribbonVRef = useRef<THREE.InstancedMesh>(null);
  const ribbonHRef = useRef<THREE.InstancedMesh>(null);
  const lightsRef = useRef<THREE.InstancedMesh>(null);
  const stockingsRef = useRef<THREE.InstancedMesh>(null);
  const stockingCuffRef = useRef<THREE.InstancedMesh>(null);
  const gingerRef = useRef<THREE.InstancedMesh>(null);
  
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const dummy2 = useMemo(() => new THREE.Object3D(), []);

  const { ballsData, giftsData, lightsData, stockingsData, gingerData } = useMemo(() => {
    const _balls: InstanceData[] = [];
    const _gifts: InstanceData[] = [];
    const _lights: InstanceData[] = [];
    const _stockings: InstanceData[] = [];
    const _ginger: InstanceData[] = [];

    const height = 11;
    const maxRadius = 4.6;
    
    // 配色：祖母绿+金，辅以宝石红蓝
    const gold = new THREE.Color("#dcb860");
    const emerald = new THREE.Color("#0b5135");
    const ruby = new THREE.Color("#8b1a1a");
    const sapphire = new THREE.Color("#1b3f73");
    const pearl = new THREE.Color("#f5e6bf");
    const champagne = new THREE.Color("#e3c07a");
    const jade = new THREE.Color("#2f6b3f");
    const cobalt = new THREE.Color("#2b5fbf");
    const blush = new THREE.Color("#b35a6b");

    const giftPalette = [gold, emerald, ruby, sapphire, pearl];
    // 彩球权重提升，金/香槟/祖母绿为主
    const ballPalette = [gold, champagne, champagne, gold, jade, jade, ruby, cobalt, pearl, blush, champagne, gold, emerald];
    const lightPalette = [new THREE.Color("#ffd479"), new THREE.Color("#fff2d1"), new THREE.Color("#b6ffe9")];

    const stockingRed = new THREE.Color("#c6252b");
    const stockingGreen = new THREE.Color("#1f6b3a");
    const gingerBrown = new THREE.Color("#b67a45");
    const stockingPalette = [
      stockingRed,
      stockingRed.clone().offsetHSL(0.02, -0.05, 0.05),
      stockingGreen,
      stockingGreen.clone().offsetHSL(-0.03, 0.04, 0.02)
    ];

    const stockingsCount = Math.max(24, Math.floor(count * 0.14));
    const gingerCount = Math.max(20, Math.floor(count * 0.11));

    const makeTargetPos = (bias = 2.4) => {
      const yNorm = Math.pow(Math.random(), bias);
      const y = yNorm * height + 0.6;
      const rScale = 1 - yNorm;
      const theta = y * 10 + Math.random() * Math.PI * 2;
      const r = maxRadius * rScale + Math.random() * 0.5;
      return new THREE.Vector3(
        r * Math.cos(theta),
        y,
        r * Math.sin(theta)
      );
    };

    const makeChaosPos = () => {
      const cR = 15 + Math.random() * 15;
      const cTheta = Math.random() * Math.PI * 2;
      const cPhi = Math.acos(2 * Math.random() - 1);
      return new THREE.Vector3(
        cR * Math.sin(cPhi) * Math.cos(cTheta),
        cR * Math.sin(cPhi) * Math.sin(cTheta) + 5,
        cR * Math.cos(cPhi)
      );
    };

    // 分配：球 55%，灯 25%，礼物 20%
    for (let i = 0; i < count; i++) {
      const rnd = Math.random();
      let type: OrnamentType = 'ball';
      if (rnd < 0.25) type = 'light';
      else if (rnd > 0.8) type = 'gift';

      const targetPos = makeTargetPos(2.5);
      const chaosPos = makeChaosPos();

      const scale =
        type === 'light'
          ? 0.14 + Math.random() * 0.16
          : type === 'gift'
            ? 0.35 + Math.random() * 0.26
            : 0.32 + Math.random() * 0.24;

      let color: THREE.Color;
      if (type === 'light') {
        color = lightPalette[Math.floor(Math.random() * lightPalette.length)];
      } else if (type === 'gift') {
        color = giftPalette[Math.floor(Math.random() * giftPalette.length)];
      } else {
        color = ballPalette[Math.floor(Math.random() * ballPalette.length)];
      }

      const data: InstanceData = {
        chaosPos,
        targetPos,
        type,
        color,
        scale,
        speed: 0.6 + Math.random() * 1.2,
        rotationOffset: new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, 0)
      };

      if (type === 'ball') _balls.push(data);
      else if (type === 'gift') _gifts.push(data);
      else _lights.push(data);
    }

    // 袜子
    for (let i = 0; i < stockingsCount; i++) {
      const targetPos = makeTargetPos(2.1);
      targetPos.x *= 1.05;
      const chaosPos = new THREE.Vector3(
        20 * (Math.random() - 0.5),
        10 + Math.random() * 10,
        20 * (Math.random() - 0.5)
      );
      _stockings.push({
        chaosPos,
        targetPos,
        type: 'stocking',
        color: stockingPalette[i % stockingPalette.length],
        scale: 0.52 + Math.random() * 0.28,
        speed: 0.7 + Math.random() * 1.0,
        rotationOffset: new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI / 4)
      });
    }

    // 姜饼人
    for (let i = 0; i < gingerCount; i++) {
      const targetPos = makeTargetPos(2.0);
      targetPos.y += 0.2;
      const chaosPos = new THREE.Vector3(
        18 * (Math.random() - 0.5),
        8 + Math.random() * 8,
        18 * (Math.random() - 0.5)
      );
      _ginger.push({
        chaosPos,
        targetPos,
        type: 'gingerbread',
        color: gingerBrown.clone().offsetHSL(0, (Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.08),
        scale: 0.48 + Math.random() * 0.24,
        speed: 0.6 + Math.random() * 1.0,
        rotationOffset: new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, 0)
      });
    }

    return { ballsData: _balls, giftsData: _gifts, lightsData: _lights, stockingsData: _stockings, gingerData: _ginger };
  }, [count]);

  useLayoutEffect(() => {
    [
      { ref: ballsRef, data: ballsData },
      { ref: giftsRef, data: giftsData },
      { ref: lightsRef, data: lightsData },
      { ref: stockingsRef, data: stockingsData },
      { ref: gingerRef, data: gingerData },
      { ref: ribbonVRef, data: giftsData },
      { ref: ribbonHRef, data: giftsData },
      { ref: stockingCuffRef, data: stockingsData },
    ].forEach(({ ref, data }) => {
      if (ref.current) {
        data.forEach((d, i) => {
          ref.current!.setColorAt(i, d.color);
        });
        if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
      }
    });
  }, [ballsData, giftsData, lightsData, stockingsData, gingerData]);

  useFrame((state, delta) => {
    const isFormed = mode === TreeMode.FORMED;
    const time = state.clock.elapsedTime;

    const updateMesh = (ref: React.RefObject<THREE.InstancedMesh>, data: InstanceData[]) => {
      if (!ref.current) return;

      let needsUpdate = false;

      data.forEach((d, i) => {
        ref.current!.getMatrixAt(i, dummy.matrix);
        dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
        
        const dest = isFormed ? d.targetPos : d.chaosPos;
        dummy.position.lerp(dest, delta * d.speed);

        if (isFormed && dummy.position.distanceTo(d.targetPos) < 0.5) {
          dummy.position.y += Math.sin(time * 2 + d.chaosPos.x) * 0.002;
        }

        if (d.type === 'gift') {
          dummy.rotation.x += delta * 0.35;
          dummy.rotation.y += delta * 0.15;
        } else if (d.type === 'stocking') {
          dummy.rotation.z = Math.sin(time * 0.8 + d.chaosPos.x) * 0.12;
          dummy.rotation.y = d.rotationOffset.y;
        } else if (d.type === 'gingerbread') {
          dummy.rotation.y += delta * 0.25;
          dummy.rotation.x = Math.sin(time * 0.5 + d.chaosPos.y) * 0.05;
        } else {
          dummy.lookAt(0, dummy.position.y, 0);
        }

        if (d.type === 'gift') {
          dummy.scale.set(d.scale * 1.05, d.scale * 1.18, d.scale * 1.05);
        } else {
          dummy.scale.setScalar(d.scale);
        }

        if (d.type === 'light') {
          const pulse = 1 + Math.sin(time * 5 + d.chaosPos.y) * 0.35;
          dummy.scale.multiplyScalar(pulse);
        } else if (d.type === 'stocking') {
          const sway = 1 + Math.sin(time * 1.2 + d.chaosPos.x) * 0.05;
          dummy.scale.multiplyScalar(sway);
        }

        dummy.updateMatrix();
        ref.current!.setMatrixAt(i, dummy.matrix);

        // 礼物丝带
        if (d.type === 'gift' && ribbonVRef.current && ribbonHRef.current) {
          dummy2.position.copy(dummy.position);
          dummy2.quaternion.copy(dummy.quaternion);
          dummy2.scale.set(d.scale * 0.22, d.scale * 1.15, d.scale * 1.08);
          dummy2.updateMatrix();
          ribbonVRef.current.setMatrixAt(i, dummy2.matrix);

          dummy2.scale.set(d.scale * 1.2, d.scale * 0.2, d.scale * 1.08);
          dummy2.updateMatrix();
          ribbonHRef.current.setMatrixAt(i, dummy2.matrix);
        }

        // 袜子袖口
        if (d.type === 'stocking' && stockingCuffRef.current) {
          dummy2.position.copy(dummy.position);
          dummy2.position.y += d.scale * 0.45;
          dummy2.quaternion.copy(dummy.quaternion);
          dummy2.scale.set(d.scale * 0.9, d.scale * 0.35, d.scale * 0.7);
          dummy2.updateMatrix();
          stockingCuffRef.current.setMatrixAt(i, dummy2.matrix);
        }

        needsUpdate = true;
      });

      if (needsUpdate) {
        ref.current.instanceMatrix.needsUpdate = true;
        if (ref === giftsRef && ribbonVRef.current && ribbonHRef.current) {
          ribbonVRef.current.instanceMatrix.needsUpdate = true;
          ribbonHRef.current.instanceMatrix.needsUpdate = true;
        }
        if (ref === stockingsRef && stockingCuffRef.current) {
          stockingCuffRef.current.instanceMatrix.needsUpdate = true;
        }
      }
    };

    updateMesh(ballsRef, ballsData);
    updateMesh(giftsRef, giftsData);
    updateMesh(lightsRef, lightsData);
    updateMesh(stockingsRef, stockingsData);
    updateMesh(gingerRef, gingerData);
  });

  return (
    <>
      {/* Balls: 高光彩球，金/香槟/祖母绿为主 */}
      <instancedMesh ref={ballsRef} args={[undefined, undefined, ballsData.length]}>
        <sphereGeometry args={[1.05, 32, 32]} />
        <meshStandardMaterial 
          roughness={0.16} 
          metalness={0.8} 
          envMapIntensity={1.35}
        />
      </instancedMesh>

      {/* Gifts: 数量较少但更厚重 */}
      <instancedMesh ref={giftsRef} args={[undefined, undefined, giftsData.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial 
          roughness={0.2} 
          metalness={0.75} 
          envMapIntensity={1.4}
          clearcoat={0.5}
          clearcoatRoughness={0.22}
          color="#ffffff" // 实际由实例颜色控制
        />
      </instancedMesh>
      {/* Gift Ribbons: 纵向与横向丝带 */}
      <instancedMesh ref={ribbonVRef} args={[undefined, undefined, giftsData.length]}>
        <boxGeometry args={[0.2, 1.3, 1.1]} />
        <meshStandardMaterial 
          roughness={0.12} 
          metalness={0.92} 
          envMapIntensity={1.6}
          color="#f6d87a"
        />
      </instancedMesh>
      <instancedMesh ref={ribbonHRef} args={[undefined, undefined, giftsData.length]}>
        <boxGeometry args={[1.3, 0.2, 1.1]} />
        <meshStandardMaterial 
          roughness={0.12} 
          metalness={0.92} 
          envMapIntensity={1.6}
          color="#f6d87a"
        />
      </instancedMesh>

      {/* Lights: 次重，依靠辉光 */}
      <instancedMesh ref={lightsRef} args={[undefined, undefined, lightsData.length]}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial 
          emissive="white"
          emissiveIntensity={2.6}
          toneMapped={false}
          color="white"
        />
      </instancedMesh>

      {/* Stockings: 红/绿袜子 + 白色袖口 */}
      <instancedMesh ref={stockingsRef} args={[undefined, undefined, stockingsData.length]}>
        <boxGeometry args={[0.42, 1.05, 0.32]} />
        <meshStandardMaterial 
          roughness={0.4} 
          metalness={0.15} 
          color="#d13b3b"
        />
      </instancedMesh>
      <instancedMesh ref={stockingCuffRef} args={[undefined, undefined, stockingsData.length]}>
        <boxGeometry args={[0.48, 0.32, 0.4]} />
        <meshStandardMaterial 
          roughness={0.35} 
          metalness={0.1} 
          color="#f8f4ec"
        />
      </instancedMesh>

      {/* Gingerbread: 带微弱糖霜发光 */}
      <instancedMesh ref={gingerRef} args={[undefined, undefined, gingerData.length]}>
        <boxGeometry args={[0.6, 0.85, 0.18]} />
        <meshStandardMaterial 
          roughness={0.6} 
          metalness={0.08} 
          color="#b67a45"
          emissive="#f5e6bf"
          emissiveIntensity={0.25}
        />
      </instancedMesh>
    </>
  );
};
