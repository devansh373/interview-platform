import { useState, useCallback } from "react";

/**
 * Hook to transcribe audio using Speech-to-Text API
 */
export function useTranscription() {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptions, setTranscriptions] = useState([]);

  const STT_API = "https://stt-parvez.onrender.com/transcribe";

  /**
   * Transcribe an audio blob
   * @param {Blob} audioBlob - Audio blob to transcribe
   * @param {number} questionIndex - Index of the question
   * @param {string} questionText - The question text
   * @returns {Promise<string>} - Transcribed text
   */
  const transcribeAudio = useCallback(
    async (audioBlob, questionIndex, questionText) => {
      setIsTranscribing(true);

      try {
        // Create FormData to send audio file
        const formData = new FormData();
        formData.append("file", audioBlob, `answer_${questionIndex + 1}.webm`);

        console.log(`🎤 Transcribing answer ${questionIndex + 1}...`);

        const response = await fetch(STT_API, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Transcription failed: ${response.status}`);
        }

        const data = await response.json();
        const transcribedText = data.text || data.transcription || "";

        console.log(
          `✅ Answer ${questionIndex + 1} transcribed:`,
          transcribedText,
        );

        // Store transcription with question
        const transcription = {
          questionIndex,
          question: questionText,
          answer: transcribedText,
          timestamp: new Date().toISOString(),
        };

        setTranscriptions((prev) => [...prev, transcription]);
        setIsTranscribing(false);

        return transcribedText;
      } catch (error) {
        console.error("❌ Transcription error:", error);
        setIsTranscribing(false);

        // Return empty string on error, but log it
        const errorTranscription = {
          questionIndex,
          question: questionText,
          answer: "[Transcription failed]",
          error: error.message,
          timestamp: new Date().toISOString(),
        };

        setTranscriptions((prev) => [...prev, errorTranscription]);

        return "[Transcription failed]";
      }
    },
    [],
  );

  /**
   * Clear all transcriptions
   */
  const clearTranscriptions = useCallback(() => {
    setTranscriptions([]);
  }, []);

  return {
    transcribeAudio,
    transcriptions,
    isTranscribing,
    clearTranscriptions,
  };
}
