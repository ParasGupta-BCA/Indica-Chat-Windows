import { useRef, useEffect, useCallback } from 'react';
import { Globe, MessageCircle, AtSign } from 'lucide-react';

const VIDEO_SRC =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_115001_bcdaa3b4-03de-47e7-ad63-ae3e392c32d4.mp4';

const FADE_DURATION = 500; // ms
const FADE_OUT_BEFORE_END = 0.55; // seconds

/* ─── requestAnimationFrame-based fade helper ─────────────────────── */
function animateOpacity(
  el: HTMLVideoElement,
  from: number,
  to: number,
  duration: number,
  rafRef: React.MutableRefObject<number | null>,
  onDone?: () => void,
) {
  // Cancel any running animation
  if (rafRef.current !== null) {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }

  const start = performance.now();

  const step = (now: number) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    el.style.opacity = String(from + (to - from) * progress);

    if (progress < 1) {
      rafRef.current = requestAnimationFrame(step);
    } else {
      rafRef.current = null;
      onDone?.();
    }
  };

  rafRef.current = requestAnimationFrame(step);
}

/* ─── App ──────────────────────────────────────────────────────────── */
export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);
  const fadingOutRef = useRef(false);

  /* ── Fade-in on first play ─────────────────────────────────────── */
  const fadeIn = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    fadingOutRef.current = false;
    const currentOpacity = parseFloat(video.style.opacity || '0');
    animateOpacity(video, currentOpacity, 1, FADE_DURATION, rafRef);
  }, []);

  /* ── Time-update: trigger fade-out near end ────────────────────── */
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || fadingOutRef.current) return;

    const remaining = video.duration - video.currentTime;
    if (remaining <= FADE_OUT_BEFORE_END && remaining > 0) {
      fadingOutRef.current = true;
      const currentOpacity = parseFloat(video.style.opacity || '1');
      animateOpacity(video, currentOpacity, 0, FADE_DURATION, rafRef);
    }
  }, []);

  /* ── On ended: reset & replay with fade ────────────────────────── */
  const handleEnded = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.style.opacity = '0';
    setTimeout(() => {
      video.currentTime = 0;
      video.play().then(fadeIn).catch(() => {});
    }, 100);
  }, [fadeIn]);

  /* ── Initial setup ─────────────────────────────────────────────── */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.style.opacity = '0';
    video.play().then(fadeIn).catch(() => {});

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [fadeIn]);

  return (
    <div className="min-h-screen bg-black overflow-hidden flex flex-col relative">
      {/* ── Background Video ─────────────────────────────────────── */}
      <video
        ref={videoRef}
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover translate-y-[17%]"
        style={{ opacity: 0 }}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      >
        <source src={VIDEO_SRC} type="video/mp4" />
      </video>



      {/* ── Splash Content ───────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12 text-center -translate-y-[20%]">
        {/* Heading */}
        <h1
          className="text-5xl md:text-6xl lg:text-7xl text-white mb-8 tracking-tight whitespace-nowrap"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Indica Chat
        </h1>


        {/* Supporting Text */}
        <p className="text-white text-sm leading-relaxed px-4 max-w-lg mb-8">
          Your intelligent workspace. Experience a powerful platform designed to streamline communication,
          accelerate productivity, and collaborate seamlessly.
        </p>
      </main>

      {/* ── Community Footer ─────────────────────────────────────── */}
      <footer className="relative z-10 flex justify-center gap-4 pb-12">
        <a
          href="#"
          aria-label="Instagram"
          className="liquid-glass rounded-full p-4 text-white/80 hover:text-white hover:bg-white/5 transition-all"
        >
          <MessageCircle size={20} />
        </a>
        <a
          href="#"
          aria-label="Twitter"
          className="liquid-glass rounded-full p-4 text-white/80 hover:text-white hover:bg-white/5 transition-all"
        >
          <AtSign size={20} />
        </a>
        <a
          href="#"
          aria-label="Website"
          className="liquid-glass rounded-full p-4 text-white/80 hover:text-white hover:bg-white/5 transition-all"
        >
          <Globe size={20} />
        </a>
      </footer>
    </div>
  );
}
