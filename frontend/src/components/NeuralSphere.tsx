import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';

type AgentStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'executing';

interface SphereContentProps {
  isListening: boolean;
  isSpeaking: boolean;
  isExecuting: boolean;
  isProcessing: boolean;
}

function SphereContent({ isListening, isSpeaking, isExecuting, isProcessing }: SphereContentProps) {
  const outerSphereRef1 = useRef<THREE.Mesh>(null);
  const outerSphereRef2 = useRef<THREE.Mesh>(null);
  const outerSphereRef3 = useRef<THREE.Mesh>(null);
  const innerSphereRef = useRef<THREE.Mesh>(null);
  const particleRef = useRef<THREE.Points>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  // Color scheme
  const coreColor = isExecuting ? '#00d4ff' : isSpeaking ? '#ff9d3f' : isListening ? '#ff5500' : '#ff7b00';
  const outerColor = isExecuting ? '#0088cc' : '#ff7b00';
  const outerColor2 = isExecuting ? '#00ffcc' : '#ff4500';
  const particleColor = isExecuting ? '#00d4ff' : '#ff9d3f';

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const speed = isExecuting ? 2.5 : isListening ? 3.0 : isSpeaking ? 2.0 : isProcessing ? 1.5 : 1.0;

    if (outerSphereRef1.current) {
      outerSphereRef1.current.rotation.y = time * 0.12 * speed;
      outerSphereRef1.current.rotation.x = time * 0.05 * speed;
      const pulseFreq = isListening ? 7 : isExecuting ? 5 : 3.5;
      const pulseAmp = isListening ? 0.08 : isExecuting ? 0.06 : isSpeaking ? 0.04 : 0.015;
      const pulse = 1.0 + Math.sin(time * pulseFreq) * pulseAmp;
      outerSphereRef1.current.scale.set(pulse, pulse, pulse);
    }

    if (outerSphereRef2.current) {
      outerSphereRef2.current.rotation.y = -time * 0.08 * speed;
      outerSphereRef2.current.rotation.z = time * 0.06 * speed;
    }

    if (outerSphereRef3.current && isExecuting) {
      outerSphereRef3.current.rotation.x = time * 0.1;
      outerSphereRef3.current.rotation.z = -time * 0.07;
    }

    if (innerSphereRef.current) {
      innerSphereRef.current.rotation.y = -time * 0.25 * speed;
      const coreFreq = isListening ? 9 : isExecuting ? 7 : 4.5;
      const coreAmp = isListening ? 0.15 : isExecuting ? 0.12 : isSpeaking ? 0.08 : 0.025;
      const corePulse = 1.0 + Math.cos(time * coreFreq) * coreAmp;
      innerSphereRef.current.scale.set(corePulse, corePulse, corePulse);
    }

    if (particleRef.current) {
      particleRef.current.rotation.y = time * 0.03 * speed;
      particleRef.current.rotation.x = time * 0.01 * speed;
    }

    if (ringRef.current) {
      ringRef.current.rotation.z = time * 0.2 * speed;
      const ringScale = 1 + Math.sin(time * 2) * 0.05;
      ringRef.current.scale.set(ringScale, ringScale, 1);
    }
  });

  const opacity = isExecuting ? 0.35 : 0.25;
  const coreOpacity = isListening ? 0.9 : isSpeaking ? 0.75 : isExecuting ? 0.85 : 0.55;
  const haloOpacity = isListening ? 0.45 : isSpeaking ? 0.3 : isExecuting ? 0.4 : 0.15;

  return (
    <group>
      <Stars radius={100} depth={50} count={1200} factor={4} saturation={0.5} fade speed={1.5} />

      {/* Outer Neural Structure (Icosahedron Wireframe) */}
      <mesh ref={outerSphereRef1}>
        <icosahedronGeometry args={[2.0, 2]} />
        <meshBasicMaterial color={outerColor} wireframe transparent opacity={opacity} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* Secondary Wireframe */}
      <mesh ref={outerSphereRef2}>
        <dodecahedronGeometry args={[1.98, 1]} />
        <meshBasicMaterial color={outerColor2} wireframe transparent opacity={0.12} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* Agent mode: third orbital ring */}
      {isExecuting && (
        <mesh ref={outerSphereRef3}>
          <torusGeometry args={[2.2, 0.02, 8, 60]} />
          <meshBasicMaterial color="#00d4ff" transparent opacity={0.4} blending={THREE.AdditiveBlending} />
        </mesh>
      )}

      {/* Equatorial ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.8, 0.015, 8, 80]} />
        <meshBasicMaterial color={outerColor} transparent opacity={isExecuting ? 0.5 : 0.2} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* Glowing Core */}
      <mesh ref={innerSphereRef}>
        <sphereGeometry args={[0.55, 32, 32]} />
        <meshBasicMaterial color={coreColor} transparent opacity={coreOpacity} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* Core halo */}
      <mesh>
        <sphereGeometry args={[0.75, 16, 16]} />
        <meshBasicMaterial color={coreColor} transparent opacity={haloOpacity} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* Extended halo (executing mode) */}
      {isExecuting && (
        <mesh>
          <sphereGeometry args={[1.0, 16, 16]} />
          <meshBasicMaterial color="#00d4ff" transparent opacity={0.08} blending={THREE.AdditiveBlending} />
        </mesh>
      )}

      {/* Synaptic nodes */}
      <points>
        <icosahedronGeometry args={[2.0, 2]} />
        <pointsMaterial color="#ffffff" size={0.06} transparent opacity={0.85} blending={THREE.AdditiveBlending} />
      </points>

      {/* Ambient particle cloud */}
      <points ref={particleRef}>
        <sphereGeometry args={[2.4, 12, 12]} />
        <pointsMaterial color={particleColor} size={isExecuting ? 0.045 : 0.03} transparent opacity={isExecuting ? 0.5 : 0.35} blending={THREE.AdditiveBlending} />
      </points>
    </group>
  );
}

interface NeuralSphereProps {
  status: AgentStatus;
}

const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: 'STANDBY',
  listening: 'LISTENING',
  processing: 'PROCESSING',
  speaking: 'VOCALIZING',
  executing: 'AGENT EXECUTING',
};

const STATUS_COLORS: Record<AgentStatus, string> = {
  idle: '#ff7b00',
  listening: '#ff4444',
  processing: '#f59e0b',
  speaking: '#ff9d3f',
  executing: '#00d4ff',
};

export default function NeuralSphere({ status }: NeuralSphereProps) {
  const isListening = status === 'listening';
  const isSpeaking = status === 'speaking';
  const isExecuting = status === 'executing';
  const isProcessing = status === 'processing';

  const autoRotateSpeed = isListening ? 4.0 : isExecuting ? 3.5 : isSpeaking ? 2.0 : 0.6;
  const statusColor = STATUS_COLORS[status];

  return (
    <div className="w-full h-full min-h-[300px] flex flex-col justify-center items-center relative">
      {/* Top-left labels */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-1 pointer-events-none">
        <span className="label-mono" style={{ color: statusColor }}>NEURAL COGNITION</span>
        <span className="label-mono label-dim">RESOLUTION: 2048-SYNAPSE</span>
      </div>

      {/* Status badge */}
      <div className="absolute top-4 right-4 z-10 pointer-events-none">
        <div
          className="flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-mono font-bold"
          style={{
            borderColor: statusColor + '55',
            backgroundColor: statusColor + '15',
            color: statusColor
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: statusColor }}
          />
          {STATUS_LABELS[status]}
        </div>
      </div>

      <Canvas camera={{ position: [0, 0, 5], fov: 60 }} className="w-full h-full bg-transparent rounded-xl">
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <SphereContent
          isListening={isListening}
          isSpeaking={isSpeaking}
          isExecuting={isExecuting}
          isProcessing={isProcessing}
        />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={autoRotateSpeed}
        />
      </Canvas>
    </div>
  );
}
