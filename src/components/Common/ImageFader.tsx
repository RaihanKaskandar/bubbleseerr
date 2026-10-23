'use client';
// Adapted from Seerr's Common/ImageFader (MIT, https://github.com/seerr-team/seerr)
import { useEffect, useState } from 'react';

interface ImageFaderProps {
  backgroundImages: string[];
  rotationSpeed?: number;
  isDarker?: boolean;
}

export default function ImageFader({ backgroundImages, rotationSpeed = 6000, isDarker }: ImageFaderProps) {
  const [activeIndex, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setIndex((i) => (i + 1) % Math.max(backgroundImages.length, 1)), rotationSpeed);
    return () => clearInterval(interval);
  }, [backgroundImages, rotationSpeed]);

  const gradient = isDarker
    ? 'linear-gradient(180deg, rgba(17, 24, 39, 0.47) 0%, rgba(17, 24, 39, 1) 100%)'
    : 'linear-gradient(180deg, rgba(45, 55, 72, 0.47) 0%, #1A202E 100%)';

  return (
    <div aria-hidden="true">
      {backgroundImages.map((url, i) => (
        <div
          key={url}
          className={`absolute-top-shift absolute inset-0 overflow-hidden transition-opacity duration-1000 ease-in ${
            i === activeIndex ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Covers are portrait, so they're shown blurred to fill the screen */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover blur-md" />
          <div className="absolute inset-0" style={{ backgroundImage: gradient }} />
        </div>
      ))}
    </div>
  );
}
