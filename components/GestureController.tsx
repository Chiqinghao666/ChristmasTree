import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { TreeMode } from '../types';

interface GestureControllerProps {
  onModeChange: (mode: TreeMode) => void;
  currentMode: TreeMode;
  onHandPosition?: (x: number, y: number, detected: boolean) => void;
  onTwoHandsDetected?: (detected: boolean) => void;
  onSwipe?: (direction: 'left' | 'right') => void;
}

export const GestureController: React.FC<GestureControllerProps> = ({
                                                                      onModeChange,
                                                                      currentMode,
                                                                      onHandPosition,
                                                                      onTwoHandsDetected,
                                                                      onSwipe
                                                                    }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [handPos, setHandPos] = useState<{ x: number; y: number } | null>(null);

  const lastModeRef = useRef<TreeMode>(currentMode);

  // 关键修复 1: 使用 Ref 存储 onSwipe，避免闭包导致的函数拿不到问题
  const onSwipeRef = useRef(onSwipe);

  // 状态锁
  const secondHandFistRef = useRef<boolean>(false);
  const lastSwitchTimeRef = useRef<number>(0);

  // Debounce logic refs
  const openFrames = useRef(0);
  const closedFrames = useRef(0);
  const CONFIDENCE_THRESHOLD = 5;

  // 每次 props 更新时，更新 ref
  useEffect(() => {
    onSwipeRef.current = onSwipe;
  }, [onSwipe]);

  useEffect(() => {
    lastModeRef.current = currentMode;
  }, [currentMode]);

  useEffect(() => {
    let handLandmarker: HandLandmarker | null = null;
    let animationFrameId: number;

    const setupMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );

        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `${import.meta.env.BASE_URL}models/hand_landmarker.task`, // 使用 BASE_URL 兼容 GitHub Pages
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2
        });

        startWebcam();
      } catch (error) {
        console.error("Error initializing MediaPipe:", error);
      }
    };

    const startWebcam = async () => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 320, height: 240, facingMode: "user" }
          });

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.addEventListener("loadeddata", predictWebcam);
            setIsLoaded(true);
          }
        } catch (err) {
          console.error("Error accessing webcam:", err);
        }
      }
    };

    const drawSingleHandSkeleton = (landmarks: any[], ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, color: string = '#D4AF37') => {
      const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],
        [0, 5], [5, 6], [6, 7], [7, 8],
        [0, 9], [9, 10], [10, 11], [11, 12],
        [0, 13], [13, 14], [14, 15], [15, 16],
        [0, 17], [17, 18], [18, 19], [19, 20],
        [5, 9], [9, 13], [13, 17]
      ];

      ctx.lineWidth = 3;
      ctx.strokeStyle = color; // 可以区分两只手的颜色
      connections.forEach(([start, end]) => {
        const startPoint = landmarks[start];
        const endPoint = landmarks[end];

        ctx.beginPath();
        ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height);
        ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height);
        ctx.stroke();
      });

      landmarks.forEach((landmark) => {
        const x = landmark.x * canvas.width;
        const y = landmark.y * canvas.height;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fillStyle = '#228B22';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      });
    };

    const drawAllHands = (allLandmarks: any[][]) => {
      if (!canvasRef.current || !videoRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      allLandmarks.forEach((landmarks, index) => {
        // 第一只手金色，第二只手用青色区分，方便调试
        drawSingleHandSkeleton(landmarks, ctx, canvas, index === 0 ? '#D4AF37' : '#00FFFF');
      });
    };

    const predictWebcam = () => {
      if (!handLandmarker || !videoRef.current) return;

      const startTimeMs = performance.now();
      if (videoRef.current.videoWidth > 0) {
        const result = handLandmarker.detectForVideo(videoRef.current, startTimeMs);

        if (result.landmarks && result.landmarks.length > 0) {
          const twoHandsDetected = result.landmarks.length >= 2;
          if (onTwoHandsDetected) {
            onTwoHandsDetected(twoHandsDetected);
          }

          drawAllHands(result.landmarks);

          // 逻辑处理：第一只手
          detectGesture(result.landmarks[0]);

          // 逻辑处理：第二只手
          if (result.landmarks.length > 1) {
            // 这里我们始终认为数组里的第二个就是第二只手（虽然MediaPipe偶尔会乱序，但大多数情况是按置信度排序）
            detectSecondHandFist(result.landmarks[1], startTimeMs);
          } else {
            resetSecondHandGesture();
          }
        } else {
          // 无手状态重置
          setHandPos(null);
          if (onHandPosition) onHandPosition(0.5, 0.5, false);
          if (onTwoHandsDetected) onTwoHandsDetected(false);
          resetSecondHandGesture();

          if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }
          openFrames.current = Math.max(0, openFrames.current - 1);
          closedFrames.current = Math.max(0, closedFrames.current - 1);
        }
      }

      animationFrameId = requestAnimationFrame(predictWebcam);
    };

    const detectGesture = (landmarks: any[]) => {
      // 第一只手控制逻辑保持不变...
      const wrist = landmarks[0];
      const palmCenterX = (landmarks[0].x + landmarks[5].x + landmarks[9].x + landmarks[13].x + landmarks[17].x) / 5;
      const palmCenterY = (landmarks[0].y + landmarks[5].y + landmarks[9].y + landmarks[13].y + landmarks[17].y) / 5;

      setHandPos({ x: palmCenterX, y: palmCenterY });
      if (onHandPosition) {
        onHandPosition(palmCenterX, palmCenterY, true);
      }

      const fingerTips = [8, 12, 16, 20];
      const fingerBases = [5, 9, 13, 17];
      let extendedFingers = 0;

      for (let i = 0; i < 4; i++) {
        const tip = landmarks[fingerTips[i]];
        const base = landmarks[fingerBases[i]];
        const distTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
        const distBase = Math.hypot(base.x - wrist.x, base.y - wrist.y);
        if (distTip > distBase * 1.5) extendedFingers++;
      }

      const thumbTip = landmarks[4];
      const thumbBase = landmarks[2];
      const distThumbTip = Math.hypot(thumbTip.x - wrist.x, thumbTip.y - wrist.y);
      const distThumbBase = Math.hypot(thumbBase.x - wrist.x, thumbBase.y - wrist.y);
      if (distThumbTip > distThumbBase * 1.2) extendedFingers++;

      if (extendedFingers >= 4) {
        openFrames.current++;
        closedFrames.current = 0;
        if (openFrames.current > CONFIDENCE_THRESHOLD) {
          if (lastModeRef.current !== TreeMode.CHAOS) {
            lastModeRef.current = TreeMode.CHAOS;
            onModeChange(TreeMode.CHAOS);
          }
        }
      } else if (extendedFingers <= 1) {
        closedFrames.current++;
        openFrames.current = 0;
        if (closedFrames.current > CONFIDENCE_THRESHOLD) {
          if (lastModeRef.current !== TreeMode.FORMED) {
            lastModeRef.current = TreeMode.FORMED;
            onModeChange(TreeMode.FORMED);
          }
        }
      } else {
        openFrames.current = 0;
        closedFrames.current = 0;
      }
    };

    const resetSecondHandGesture = () => {
      secondHandFistRef.current = false;
    };

    // 关键修复 2: 优化的握拳判定算法
    const detectSecondHandFist = (landmarks: any[], nowMs: number) => {
      // 检查 ref 是否有值，如果没有则不执行
      if (!onSwipeRef.current) return false;

      const fingerTips = [8, 12, 16, 20]; // 食指、中指、无名指、小指
      const fingerBases = [5, 9, 13, 17];
      const wrist = landmarks[0];

      let extendedCount = 0;

      // 我们只检测4根手指，忽略拇指（拇指在握拳时很难判断）
      for (let i = 0; i < 4; i++) {
        const tip = landmarks[fingerTips[i]];
        const base = landmarks[fingerBases[i]];
        const distTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
        const distBase = Math.hypot(base.x - wrist.x, base.y - wrist.y);

        // 如果指尖距离手腕 比 指根距离手腕 远很多，认为是伸展
        // 降低系数到 1.1，让微屈也算握拳
        if (distTip > distBase * 1.1) {
          extendedCount++;
        }
      }

      // 判定逻辑：只要有3根或以上的手指是缩回的，就认为是握拳
      // 忽略拇指，因为拇指很容易误判
      const isFist = extendedCount <= 1;

      if (isFist) {
        // 冷却时间检查
        const COOLDOWN = 500; // 500ms 冷却，防止连续触发
        if (!secondHandFistRef.current && nowMs - lastSwitchTimeRef.current > COOLDOWN) {

          // 调用 ref 中的函数
          onSwipeRef.current('right');

          lastSwitchTimeRef.current = nowMs;
          secondHandFistRef.current = true;
        }
      } else {
        secondHandFistRef.current = false;
      }
    };

    setupMediaPipe();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (handLandmarker) handLandmarker.close();
    };
  }, [onModeChange]); // 依赖项里不需要 onSwipe，因为用了 ref

  return (
    <div className="absolute top-6 right-[8%] z-50 flex flex-col items-end pointer-events-none">
      <div className="relative w-[18.75vw] h-[14.0625vw] border-2 border-[#D4AF37] rounded-lg overflow-hidden shadow-[0_0_20px_rgba(212,175,55,0.3)] bg-black">
        <div className="absolute inset-0 border border-[#F5E6BF]/20 m-1 rounded-sm z-10"></div>

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transform -scale-x-100 transition-opacity duration-1000 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        />

        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 pointer-events-none z-20"
        />

        {/* 手状态与调试信息已隐藏，如需恢复可在此添加自定义层 */}
      </div>
    </div>
  );
};
