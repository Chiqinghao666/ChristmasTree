
import React, { useState, Suspense, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader } from '@react-three/drei';
import { Experience } from './components/Experience';
import { UIOverlay } from './components/UIOverlay';
import { GestureController } from './components/GestureController';
import { TreeMode } from './types';
const bg1 = '/backgrounds/6.jpg'; // 直接走静态路径，避免打包路径问题

// Simple Error Boundary to catch 3D resource loading errors (like textures)
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Error loading 3D scene:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // You can customize this fallback UI
      return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 text-[#D4AF37] font-serif p-8 text-center">
          <div>
            <h2 className="text-2xl mb-2">Something went wrong</h2>
            <p className="opacity-70">A resource failed to load (likely a missing image). Check the console for details.</p>
            <button 
              onClick={() => this.setState({ hasError: false })}
              className="mt-4 px-4 py-2 border border-[#D4AF37] hover:bg-[#D4AF37] hover:text-black transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [mode, setMode] = useState<TreeMode>(TreeMode.FORMED);
  const [handPosition, setHandPosition] = useState<{ x: number; y: number; detected: boolean }>({ x: 0.5, y: 0.5, detected: false });
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [isLoadingShare, setIsLoadingShare] = useState(false);
  const [isSharedView, setIsSharedView] = useState(false);
  const [twoHandsDetected, setTwoHandsDetected] = useState(false);
  const [closestPhoto, setClosestPhoto] = useState<string | null>(null);
  const [manualPhotoIndex, setManualPhotoIndex] = useState<number | null>(null);
  // 本地默认照片：从 pictures 目录读取，作为无上传时的展示来源
  const localPhotos = useMemo<string[]>(() => {
    const modules = import.meta.glob('./pictures/*.{png,jpg,jpeg,JPG,JPEG,webp,avif}', {
      eager: true,
      as: 'url',
    }) as Record<string, string>;
    return Object.values(modules);
  }, []);

  // Check for share parameter in URL on mount
  useEffect(() => {
    const loadSharedPhotos = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const shareId = urlParams.get('share');

      if (!shareId) return;

      setIsSharedView(true);
      setIsLoadingShare(true);

      try {
        // Try API first (works in vercel dev and production)
        try {
          const response = await fetch(`/api/share?id=${shareId}`);
          const data = await response.json();

          if (response.ok && data.success) {
            setUploadedPhotos(data.images);
            return;
          }
        } catch (apiError) {
          console.log('API not available, trying localStorage fallback');
        }

        // Fallback to localStorage if API fails (pure vite dev mode)
        const shareDataStr = localStorage.getItem(`share_${shareId}`);
        if (shareDataStr) {
          const shareData = JSON.parse(shareDataStr);
          setUploadedPhotos(shareData.images);
        } else {
          console.error('Share not found');
        }
      } catch (error) {
        console.error('Error loading shared photos:', error);
      } finally {
        setIsLoadingShare(false);
      }
    };

    loadSharedPhotos();
  }, []);
  
  // 若非分享模式且尚无照片，则默认载入本地 pictures 目录
  useEffect(() => {
    if (!isSharedView && uploadedPhotos.length === 0 && localPhotos.length > 0) {
      setUploadedPhotos(localPhotos);
    }
  }, [isSharedView, uploadedPhotos.length, localPhotos]);
  
  // 当双手离开时，关闭大图并重置手动索引
  useEffect(() => {
    if (!twoHandsDetected) {
      setClosestPhoto(null);
      setManualPhotoIndex(null);
    }
  }, [twoHandsDetected]);

  const toggleMode = () => {
    setMode((prev) => (prev === TreeMode.FORMED ? TreeMode.CHAOS : TreeMode.FORMED));
  };

  // 若照片列表变化，确保索引有效
  useEffect(() => {
    if (manualPhotoIndex !== null && manualPhotoIndex >= uploadedPhotos.length) {
      setManualPhotoIndex(uploadedPhotos.length > 0 ? 0 : null);
    }
  }, [uploadedPhotos.length, manualPhotoIndex]);

  const handleHandPosition = (x: number, y: number, detected: boolean) => {
    setHandPosition({ x, y, detected });
  };

  const handleTwoHandsDetected = (detected: boolean) => {
    setTwoHandsDetected(detected);
  };

  // 第二只手左右滑动切换大图
  const handleSwipe = (direction: 'left' | 'right') => {
    if (uploadedPhotos.length === 0) return;
    setManualPhotoIndex((prev) => {
      const current = prev ?? 0;
      const max = uploadedPhotos.length;
      if (direction === 'right') return (current + 1) % max;
      return (current - 1 + max) % max;
    });
  };

  const handleClosestPhotoChange = (photoUrl: string | null) => {
    setClosestPhoto(photoUrl);
  };

  // 记录 Polaroids 内部自动选中的索引，保持与大图同步
  const handleSelectedIndexChange = (index: number) => {
    setManualPhotoIndex(index);
  };

  const handlePhotosUpload = (photos: string[]) => {
    setUploadedPhotos(photos);
  };

  // 背景样式：使用 1.jpg，并叠加轻微渐变，避免干扰主体
  const backgroundStyle = useMemo(() => ({
    backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,20,10,0.35) 50%, rgba(0,0,0,0.55) 100%), url(${bg1})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
    backgroundColor: '#000' // fallback
  }), []);

  return (
    <div className="w-full h-screen relative overflow-hidden" style={backgroundStyle}>
      {/* 背景遮罩，确保树体清晰可见 */}
      <div className="absolute inset-0 bg-black/10 pointer-events-none" />
      <ErrorBoundary>
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 4, 20], fov: 45 }}
          gl={{ antialias: false, stencil: false, alpha: true }}
          style={{ background: 'transparent' }}
          shadows
        >
          <Suspense fallback={null}>
            <Experience 
              mode={mode} 
              handPosition={handPosition} 
              uploadedPhotos={uploadedPhotos} 
              twoHandsDetected={twoHandsDetected} 
              onClosestPhotoChange={handleClosestPhotoChange}
              selectedPhotoIndex={manualPhotoIndex ?? undefined}
              onSelectedPhotoIndexChange={handleSelectedIndexChange}
            />
          </Suspense>
        </Canvas>
      </ErrorBoundary>
      
      <Loader 
        containerStyles={{ background: '#000' }} 
        innerStyles={{ width: '300px', height: '10px', background: '#333' }}
        barStyles={{ background: '#D4AF37', height: '10px' }}
        dataStyles={{ color: '#D4AF37', fontFamily: 'Cinzel' }}
      />
      
      <UIOverlay 
        mode={mode} 
        onToggle={toggleMode} 
        onPhotosUpload={handlePhotosUpload} 
        hasPhotos={uploadedPhotos.length > 0}
        uploadedPhotos={uploadedPhotos}
        isSharedView={isSharedView}
      />
      
      {/* Loading indicator for shared photos */}
      {isLoadingShare && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="text-[#D4AF37] font-serif text-xl">
            加载分享的照片中...
          </div>
        </div>
      )}
      
      {/* Gesture Control Module */}
      <GestureController 
        currentMode={mode} 
        onModeChange={setMode} 
        onHandPosition={handleHandPosition} 
        onTwoHandsDetected={handleTwoHandsDetected} 
        onSwipe={handleSwipe}
      />
      
      {/* Photo Overlay - Shows when two hands detected */}
      {closestPhoto && (
        <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none animate-fade-in">
          {/* Semi-transparent backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
          
          {/* Polaroid frame with photo */}
          <div className="relative z-50 transform transition-all duration-500 ease-out animate-scale-in">
            {/* Polaroid container */}
            <div className="bg-white p-4 pb-8 shadow-2xl" style={{ width: '60vmin', maxWidth: '600px' }}>
              {/* Gold clip at top */}
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-6 bg-gradient-to-b from-[#D4AF37] to-[#C5A028] rounded-sm shadow-lg"></div>
              
              {/* Photo */}
              <img 
                src={closestPhoto} 
                alt="Selected Memory" 
                className="w-full aspect-square object-cover"
              />
              
              {/* Text label */}
              <div className="text-center mt-4 font-serif text-gray-700 text-lg">
                Happy Memories
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
