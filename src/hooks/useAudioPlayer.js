import { useRef, useEffect, useState } from "react";

export function useAudioPlayer(src, onEnded) {
  const audioRef = useRef(new Audio(src));
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Reset audio when source changes
    audioRef.current.pause();
    audioRef.current = new Audio(src);
    audioRef.current.onended = () => {
      setIsPlaying(false);
      if (onEnded) onEnded();
    };
    audioRef.current.onerror = () => {
      setError("Audio file not found or unplayable.");
      setIsPlaying(false);
      // For demo purposes, we can simulate end after a timeout if file is missing
      console.warn("Audio error, simulating playback for demo:", src);
      setTimeout(() => {
        if (onEnded) onEnded();
      }, 3000);
    };

    return () => {
      audioRef.current.pause();
      audioRef.current.src = "";
    };
  }, [src, onEnded]);

  const play = () => {
    setIsPlaying(true);
    setError(null);
    audioRef.current.play().catch((e) => {
      console.error("Playback failed", e);
      setError(e.message);
      setIsPlaying(false);
      // Fallback for autoplay blocks or missing files
      setTimeout(() => {
        if (onEnded) onEnded();
      }, 3000);
    });
  };

  const stop = () => {
    setIsPlaying(false);
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
  };

  return { isPlaying, play, stop, error };
}
