import { useState, useRef, useCallback } from "react";

export function useVideoRecorder() {
  const [stream, setStream] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [error, setError] = useState(null);
  const mediaRecorderRef = useRef(null);
  const combinedStreamRef = useRef(null);
  const audioContextRef = useRef(null);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);

    if (combinedStreamRef.current) {
      combinedStreamRef.current.getTracks().forEach((track) => track.stop());
      combinedStreamRef.current = null;
    }

    // Also clean up state stream if it's different (though we sync them)
    setStream((prevStream) => {
      if (prevStream) {
        prevStream.getTracks().forEach((track) => track.stop());
      }
      return null;
    });

    if (audioContextRef.current) {
      audioContextRef.current.close().catch((e) => console.error(e));
      audioContextRef.current = null;
    }
  }, []);

  const startRecordingFlow = useCallback(
    async (auxAudioStream) => {
      try {
        // 1. Direct Camera + Mic Capture
        const userStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        // 2. Set up Audio Mixing
        const audioCtx = new (
          window.AudioContext || window.webkitAudioContext
        )();
        audioContextRef.current = audioCtx;

        const destination = audioCtx.createMediaStreamDestination();

        // Add Mic to Mix
        if (userStream.getAudioTracks().length > 0) {
          const micSource = audioCtx.createMediaStreamSource(userStream);
          micSource.connect(destination);
        }

        // Add Auxiliary Audio (TTS) to Mix
        // Note: captureStream() may have 0 tracks initially
        // We must wait for tracks before creating MediaStreamSource
        if (auxAudioStream) {
          const connectTTSAudio = () => {
            const tracks = auxAudioStream.getAudioTracks();
            if (tracks.length > 0) {
              try {
                const auxSource =
                  audioCtx.createMediaStreamSource(auxAudioStream);
                auxSource.connect(destination);
                console.log("✅ TTS audio connected:", tracks.length, "tracks");
                return true;
              } catch (err) {
                console.error("❌ TTS connection failed:", err);
                return false;
              }
            }
            return false;
          };

          // Try immediate connection
          if (!connectTTSAudio()) {
            // Wait for tracks to be added
            console.log("⏳ Monitoring TTS stream for audio tracks...");
            auxAudioStream.addEventListener(
              "addtrack",
              () => {
                console.log("🎵 TTS track detected, connecting...");
                connectTTSAudio();
              },
              { once: true },
            );
          }
        } else {
          console.warn("⚠️ No TTS audio stream provided");
        }

        // 3. Create Combined Stream (Camera Video + Mixed Audio)
        const tracks = [
          ...userStream.getVideoTracks(),
          ...destination.stream.getAudioTracks(),
        ];
        const combinedStream = new MediaStream(tracks);

        combinedStreamRef.current = combinedStream;
        setStream(userStream); // Show camera in UI, but record combined

        // 4. Start Recording Combined Stream
        const options = MediaRecorder.isTypeSupported("video/webm; codecs=vp9")
          ? { mimeType: "video/webm; codecs=vp9" }
          : { mimeType: "video/webm" };

        let recorder;
        try {
          recorder = new MediaRecorder(combinedStream, options);
        } catch {
          recorder = new MediaRecorder(combinedStream);
        }

        mediaRecorderRef.current = recorder;
        setRecordedChunks([]);

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            setRecordedChunks((prev) => [...prev, event.data]);
          }
        };

        userStream.getVideoTracks()[0].onended = () => {
          stopRecording();
        };

        recorder.start(1000);
        setIsRecording(true);
        setError(null);
      } catch (err) {
        console.error("Recording error:", err);
        if (
          err.name === "NotAllowedError" ||
          err.name === "PermissionDeniedError"
        ) {
          setError(
            "Permission denied. Please allow camera and microphone access to proceed.",
          );
        } else {
          setError("Could not start recording: " + err.message);
        }
      }
    },
    [stopRecording],
  );

  return {
    startRecordingFlow,
    stopRecording,
    isRecording,
    recordedChunks,
    stream,
    error,
  };
}
