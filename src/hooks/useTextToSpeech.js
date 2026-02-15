import { useState, useCallback, useRef, useEffect } from "react";

// Custom TTS streaming endpoint
// Voice: English US - Aria Neural, Speech Rate: +15%
const TTS_API = "https://audio-stream-wl47.onrender.com/tts-stream"; // Update with your actual endpoint URL

export function useTextToSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [supported] = useState(true); // Audio API is always supported
  const audioRef = useRef(new Audio());
  const lastBlobRef = useRef(null);
  const [audioStream, setAudioStream] = useState(null);

  // Initialize audio element settings and capture stream
  useEffect(() => {
    const audio = audioRef.current;

    // Important for capturing stream from external source
    audio.crossOrigin = "anonymous";

    // Ensure audio plays (required for captureStream to work)
    audio.volume = 1.0;
    audio.muted = false;

    // Capture the stream for recording
    // Note: captureStream() is standard, mozCaptureStream is Firefox prefix
    if (audio.captureStream) {
      setAudioStream(audio.captureStream());
      console.log("✅ Audio stream captured for recording");
    } else if (audio.mozCaptureStream) {
      setAudioStream(audio.mozCaptureStream());
      console.log("✅ Audio stream captured for recording (Firefox)");
    } else {
      console.warn("⚠️ captureStream not supported");
    }

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);

  const speak = useCallback(async (text, onEnd) => {
    const audio = audioRef.current;

    try {
      // Call custom TTS endpoint with POST request
      const response = await fetch(TTS_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error(`TTS API error: ${response.status}`);
      }

      // Convert response to blob
      const blob = await response.blob();
      lastBlobRef.current = blob; // Store for segment recording
      const url = URL.createObjectURL(blob);
      audio.src = url;

      // IMPORTANT: Recreate the audio stream for each new audio source
      // This ensures that captureStream() captures the new audio, not just the first one
      if (audio.captureStream) {
        setAudioStream(audio.captureStream());
        console.log("✅ Audio stream recreated for new question");
      } else if (audio.mozCaptureStream) {
        setAudioStream(audio.mozCaptureStream());
        console.log("✅ Audio stream recreated for new question (Firefox)");
      }

      const handleEnded = () => {
        setIsSpeaking(false);
        if (onEnd) onEnd(lastBlobRef.current); // Pass blob to callback
        audio.removeEventListener("ended", handleEnded);
        URL.revokeObjectURL(url); // Clean up blob URL
      };

      const handleError = (e) => {
        console.error("TTS Audio Error:", e);
        setIsSpeaking(false);
        if (onEnd) onEnd();
        audio.removeEventListener("error", handleError);
        URL.revokeObjectURL(url); // Clean up blob URL
      };

      audio.addEventListener("ended", handleEnded);
      audio.addEventListener("error", handleError);

      // Play
      setIsSpeaking(true);

      // Ensure we play
      await audio.play();
    } catch (err) {
      console.error("TTS Fetch Error:", err);
      setIsSpeaking(false);
      if (onEnd) onEnd();
    }
  }, []);

  const cancel = useCallback(() => {
    const audio = audioRef.current;
    audio.pause();
    audio.currentTime = 0;
    setIsSpeaking(false);
  }, []);

  return {
    speak,
    cancel,
    isSpeaking,
    supported,
    audioStream,
    lastBlob: lastBlobRef.current,
  };
}
