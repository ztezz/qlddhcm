import React, { useRef, useEffect, useState } from 'react';

export const VideoBackground = () => {
  const videoRef1 = useRef<HTMLVideoElement>(null);
  const videoRef2 = useRef<HTMLVideoElement>(null);
  const [opacity1, setOpacity1] = useState(1);
  const [opacity2, setOpacity2] = useState(0);
  const stateRef = useRef({ activeVideo: 1, isCrossfading: false });

  useEffect(() => {
    const video1 = videoRef1.current;
    const video2 = videoRef2.current;

    if (!video1 || !video2) return;

    const CROSSFADE_START_TIME = 2;
    let animationId: number;

    const handleLoadedMetadata = () => {
      const duration = video1.duration;

      const loop = () => {
        const state = stateRef.current;
        const activeVideo = state.activeVideo === 1 ? video1 : video2;
        const inactiveVideo = state.activeVideo === 1 ? video2 : video1;
        const duration = activeVideo.duration;
        const timeUntilEnd = duration - activeVideo.currentTime;

        // Start crossfade when close to end
        if (timeUntilEnd <= CROSSFADE_START_TIME && !state.isCrossfading) {
          state.isCrossfading = true;

          // Reset inactive video
          inactiveVideo.currentTime = 0;
          inactiveVideo.play();
        }

        // During crossfade
        if (state.isCrossfading) {
          const progress = 1 - (timeUntilEnd / CROSSFADE_START_TIME);
          const fadeProgress = Math.max(0, Math.min(progress, 1));

          if (state.activeVideo === 1) {
            setOpacity1(1 - fadeProgress);
            setOpacity2(fadeProgress);
          } else {
            setOpacity2(1 - fadeProgress);
            setOpacity1(fadeProgress);
          }

          // Complete crossfade
          if (fadeProgress >= 1) {
            activeVideo.pause();
            activeVideo.currentTime = 0;
            state.activeVideo = state.activeVideo === 1 ? 2 : 1;
            state.isCrossfading = false;
          }
        }

        animationId = requestAnimationFrame(loop);
      };

      video1.play().catch(err => console.log('Video play error:', err));
      animationId = requestAnimationFrame(loop);
    };

    video1.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video1.removeEventListener('loadedmetadata', handleLoadedMetadata);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-black">
      {/* Video 1 */}
      <video
        ref={videoRef1}
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          opacity: opacity1,
          transition: 'opacity 0.05s linear',
        }}
      >
        <source src="/media/earth_loop.mp4" type="video/mp4" />
      </video>

      {/* Video 2 */}
      <video
        ref={videoRef2}
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          opacity: opacity2,
          transition: 'opacity 0.05s linear',
        }}
      >
        <source src="/media/earth_loop.mp4" type="video/mp4" />
      </video>
    </div>
  );
};
