import { useState, useCallback, useRef } from "react";

/**
 * Hook to record individual audio segments (questions and answers)
 * Separate from the main video recording
 */
export function useSegmentRecorder() {
  const [segments, setSegments] = useState([]);
  const segmentsRef = useRef([]);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const currentSegmentRef = useRef(null);

  /**
   * Start recording a segment (question or answer)
   * @param {MediaStream} stream - Audio stream to record
   * @param {string} type - 'question' or 'answer'
   * @param {number} index - Question/Answer index
   */
  const startSegment = useCallback((stream, type, index) => {
    if (!stream) {
      console.error("No stream provided for segment recording");
      return;
    }

    // Check if stream has any tracks
    const tracks = stream.getTracks();
    if (tracks.length === 0) {
      console.error("Stream has no tracks available for recording");
      return;
    }

    chunksRef.current = [];
    currentSegmentRef.current = { type, index };

    try {
      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const segment = {
          type: currentSegmentRef.current.type,
          index: currentSegmentRef.current.index,
          blob,
          timestamp: new Date().toISOString(),
        };

        segmentsRef.current = [...segmentsRef.current, segment];
        setSegments((prev) => [...prev, segment]);
        chunksRef.current = [];
      };

      recorder.start(100); // Collect data every 100ms
      mediaRecorderRef.current = recorder;

      console.log(`Started recording ${type} ${index}`);
    } catch (err) {
      console.error("Error starting segment recording:", err);
    }
  }, []);

  /**
   * Stop the current segment recording
   */
  const stopSegment = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
      console.log(
        `Stopped recording ${currentSegmentRef.current?.type} ${currentSegmentRef.current?.index}`,
      );
    }
  }, []);

  /**
   * Download all recorded segments
   */
  const downloadSegments = useCallback(() => {
    segments.forEach((segment) => {
      const url = URL.createObjectURL(segment.blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `${segment.type}_${segment.index + 1}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }, [segments]);

  /**
   * Manually add a segment (useful for pre-recorded audio like TTS)
   */
  const addSegment = useCallback((type, index, blob) => {
    const segment = {
      type,
      index,
      blob,
      timestamp: new Date().toISOString(),
    };
    segmentsRef.current = [...segmentsRef.current, segment];
    setSegments((prev) => [...prev, segment]);
  }, []);

  /**
   * Get current segments synchronously
   */
  const getSegments = useCallback(() => {
    return segmentsRef.current;
  }, []);

  /**
   * Clear all segments
   */
  const clearSegments = useCallback(() => {
    segmentsRef.current = [];
    setSegments([]);
  }, []);

  return {
    segments,
    startSegment,
    stopSegment,
    addSegment,
    getSegments,
    downloadSegments,
    clearSegments,
  };
}
