import { useState, useRef, useEffect } from "react";
import { useTextToSpeech } from "../hooks/useTextToSpeech";
import { useVideoRecorder } from "../hooks/useVideoRecorder";
import { useSegmentRecorder } from "../hooks/useSegmentRecorder";
import { useTranscription } from "../hooks/useTranscription";
import "../index.css";

const Step = {
  INTRO: "INTRO",
  RECORDING: "RECORDING",
  COMPLETED: "COMPLETED",
};

const InterviewSession = ({ questions }) => {
  const [currentStep, setStep] = useState(Step.INTRO);
  const [qIndex, setQIndex] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const videoRef = useRef(null);
  const questionAudioSavedRef = useRef(new Set()); // Track which questions have audio saved

  const { speak, cancel, audioStream, lastBlob } = useTextToSpeech();

  const {
    stream,
    startRecordingFlow,
    stopRecording,
    reconnectTTSAudio,
    recordedChunks,
    isRecording,
    error: videoError,
  } = useVideoRecorder();

  const { startSegment, stopSegment, addSegment, getSegments } =
    useSegmentRecorder();

  const { transcribeAudio, transcriptions, isTranscribing } =
    useTranscription();

  // Handle stream mounting
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Reconnect TTS audio stream whenever it changes (for each new question)
  useEffect(() => {
    if (audioStream && isRecording) {
      reconnectTTSAudio(audioStream);
    }
  }, [audioStream, isRecording, reconnectTTSAudio]);

  const playQuestion = (text, index) => {
    setIsSpeaking(true);

    speak(text, (audioBlob) => {
      setIsSpeaking(false);

      // Save the question audio blob
      if (audioBlob && !questionAudioSavedRef.current.has(index)) {
        addSegment("question", index, audioBlob);
        questionAudioSavedRef.current.add(index);
      }

      // Start recording answer audio (candidate's response)
      if (stream) {
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length > 0) {
          const answerStream = new MediaStream(audioTracks);
          startSegment(answerStream, "answer", index);
          setIsAnswering(true);
        }
      }
    });
  };

  const handleStart = async () => {
    // 1. Request continuous recording (Video+Audio)
    await startRecordingFlow(audioStream);

    // 2. Wait a moment for recording to stabilize, then start Q1
    setStep(Step.RECORDING);
    // Don't auto-speak immediately, wait for the *stream* to be active.
  };

  // Effect to trigger Q1 once recording is actually active
  useEffect(() => {
    if (
      isRecording &&
      currentStep === Step.RECORDING &&
      qIndex === 0 &&
      !isSpeaking
    ) {
      // Small delay to ensure the stream is active
      setTimeout(() => {
        playQuestion(questions[0].text, 0);
      }, 1000);
    }
  }, [isRecording, currentStep]); // removing qIndex dep to avoid re-triggering, handled by condition

  const handleNext = async () => {
    // Save the current question audio blob if it hasn't been saved yet
    // (happens when user skips before question finishes playing)
    if (isSpeaking && lastBlob && !questionAudioSavedRef.current.has(qIndex)) {
      addSegment("question", qIndex, lastBlob);
      questionAudioSavedRef.current.add(qIndex);
    }

    cancel(); // Stop current speech

    // Stop recording the current answer (don't transcribe yet)
    if (isAnswering) {
      stopSegment();
      setIsAnswering(false);
    }

    if (qIndex < questions.length - 1) {
      const nextIndex = qIndex + 1;
      setQIndex(nextIndex);
      setTimeout(() => playQuestion(questions[nextIndex].text, nextIndex), 500);
    } else {
      finishInterview();
    }
  };

  const finishInterview = async () => {
    // Save the last question audio blob if it hasn't been saved yet
    if (isSpeaking && lastBlob && !questionAudioSavedRef.current.has(qIndex)) {
      addSegment("question", qIndex, lastBlob);
      questionAudioSavedRef.current.add(qIndex);
    }

    cancel();

    // Stop the last answer recording
    if (isAnswering) {
      stopSegment();
      setIsAnswering(false);
    }

    stopRecording();

    // Wait a moment for the last segment to be saved
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Get all segments synchronously
    const allSegments = getSegments();
    const answerSegments = allSegments.filter((s) => s.type === "answer");

    console.log(
      `🎤 Starting transcription of ${answerSegments.length} answers...`,
    );

    // Transcribe all answer segments
    for (let i = 0; i < answerSegments.length; i++) {
      const segment = answerSegments[i];
      if (segment.blob) {
        console.log(`Transcribing answer ${i + 1}/${answerSegments.length}...`);
        await transcribeAudio(
          segment.blob,
          segment.index,
          questions[segment.index].text,
        );
      }
    }

    console.log("✅ All answers transcribed!");
    setStep(Step.COMPLETED);
  };

  const downloadVideo = () => {
    if (recordedChunks.length === 0) return;
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";
    a.href = url;
    a.download = "full-interview.webm";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadResults = () => {
    // Build interview results object
    const interviewResults = {
      interviewDate: new Date().toISOString(),
      questionsAndAnswers: transcriptions.map((t) => ({
        question: t.question,
        answer: t.answer,
      })),
      totalQuestions: questions.length,
      completedQuestions: transcriptions.length,
    };

    // Download as JSON
    const blob = new Blob([JSON.stringify(interviewResults, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";
    a.href = url;
    a.download = `interview-results-${Date.now()}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (currentStep === Step.COMPLETED) {
    // Show loading screen while transcribing
    if (isTranscribing) {
      return (
        <div
          className="glass-panel"
          style={{
            textAlign: "center",
            maxWidth: "600px",
            margin: "0 auto",
            padding: "3rem 2rem",
          }}
        >
          <div style={{ marginBottom: "2rem" }}>
            <div
              className="spinner"
              style={{
                border: "4px solid rgba(99, 102, 241, 0.2)",
                borderTop: "4px solid #818cf8",
                borderRadius: "50%",
                width: "60px",
                height: "60px",
                animation: "spin 1s linear infinite",
                margin: "0 auto",
              }}
            ></div>
          </div>
          <h2
            style={{
              fontSize: "1.8rem",
              marginBottom: "1rem",
              color: "#e4e4e7",
            }}
          >
            Getting Your Results Ready<span className="loading-dots">...</span>
          </h2>
          <p style={{ color: "#a5b4fc", fontSize: "1rem", lineHeight: "1.6" }}>
            We're processing your interview responses.
            <br />
            This will just take a moment.
          </p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes loadingDots {
              0%, 20% { content: '.'; }
              40% { content: '..'; }
              60%, 100% { content: '...'; }
            }
            .loading-dots {
              animation: loadingDots 1.5s infinite;
            }
          `}</style>
        </div>
      );
    }

    return (
      <div
        className="glass-panel"
        style={{ textAlign: "center", maxWidth: "700px", margin: "0 auto" }}
      >
        <h2>Interview Completed!</h2>
        <p>Your interview has been transcribed.</p>
        <p
          style={{ color: "#a5b4fc", fontSize: "0.9rem", marginTop: "0.5rem" }}
        >
          {transcriptions.length} of {questions.length} questions answered
        </p>

        {/* Show transcriptions */}
        {transcriptions.length > 0 && (
          <div
            style={{
              marginTop: "2rem",
              textAlign: "left",
              maxHeight: "300px",
              overflowY: "auto",
            }}
          >
            <h3 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>
              Interview Transcript:
            </h3>
            {transcriptions.map((t, idx) => (
              <div
                key={idx}
                style={{
                  marginBottom: "1.5rem",
                  padding: "1rem",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: "8px",
                }}
              >
                <p
                  style={{
                    color: "#a5b4fc",
                    fontWeight: "600",
                    marginBottom: "0.5rem",
                  }}
                >
                  Q{idx + 1}: {t.question}
                </p>
                <p style={{ color: "#e4e4e7", fontSize: "0.95rem" }}>
                  A: {t.answer || "[No answer recorded]"}
                </p>
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: "1rem",
            justifyContent: "center",
            marginTop: "2rem",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={downloadResults}
            className="primary-btn"
            style={{ marginTop: 0 }}
          >
            Download Interview Results (JSON)
          </button>
          <button
            onClick={downloadVideo}
            style={{
              padding: "1rem",
              background: "transparent",
              border: "1px solid #3f3f46",
              cursor: "pointer",
              color: "white",
              borderRadius: "12px",
            }}
          >
            Download Video
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "1rem",
              background: "transparent",
              border: "1px solid #3f3f46",
              cursor: "pointer",
              color: "white",
              borderRadius: "12px",
            }}
          >
            New Interview
          </button>
        </div>
      </div>
    );
  }

  if (currentStep === Step.INTRO) {
    return (
      <div
        className="glass-panel"
        style={{ maxWidth: "600px", margin: "0 auto" }}
      >
        <h2>Start Interview Recording</h2>
        <p>We will record your video and audio for the entire session.</p>

        <div
          style={{
            background: "rgba(99, 102, 241, 0.1)",
            border: "1px solid rgba(99, 102, 241, 0.3)",
            padding: "1rem",
            borderRadius: "8px",
            margin: "1rem 0",
            textAlign: "left",
          }}
        >
          <strong style={{ color: "#818cf8" }}>Instructions:</strong>
          <ul
            style={{
              margin: "0.5rem 0 0 1.5rem",
              color: "#e0e7ff",
              lineHeight: "1.6",
            }}
          >
            <li>Click "Start & Record".</li>
            <li>
              Please <strong>Allow</strong> access to your camera and
              microphone.
            </li>
            <li>
              Once started, listen to the question and provide your answer.
            </li>
            <li>
              Ensure you are in a quiet environment and your face is visible.
            </li>
          </ul>
        </div>

        {videoError && <p style={{ color: "#ef4444" }}>{videoError}</p>}

        <button className="primary-btn" onClick={handleStart}>
          Start & Record
        </button>
      </div>
    );
  }

  const currentQ = questions[qIndex];

  return (
    <div
      className="interview-container"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(300px, 1fr) 1fr",
        gap: "2rem",
        height: "80vh",
        padding: "1rem",
        position: "relative",
      }}
    >
      {/* Full-screen loading overlay during transcription */}
      {isTranscribing && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(9, 9, 11, 0.98)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            borderRadius: "16px",
          }}
        >
          <div
            style={{ textAlign: "center", maxWidth: "400px", width: "100%" }}
          >
            <p
              style={{
                color: "#e4e4e7",
                fontSize: "1.3rem",
                marginBottom: "2rem",
                fontWeight: "500",
              }}
            >
              Analyzing...
            </p>
            {/* Loading bar */}
            <div
              style={{
                width: "100%",
                height: "8px",
                background: "rgba(99, 102, 241, 0.2)",
                borderRadius: "4px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  background: "linear-gradient(90deg, #818cf8, #6366f1)",
                  borderRadius: "4px",
                  animation: "loadingBar 1.5s ease-in-out infinite",
                }}
              ></div>
            </div>
          </div>
          <style>{`
            @keyframes loadingBar {
              0% {
                width: 0%;
                margin-left: 0%;
              }
              50% {
                width: 70%;
                margin-left: 15%;
              }
              100% {
                width: 0%;
                margin-left: 100%;
              }
            }
          `}</style>
        </div>
      )}

      {/* Left: Question Area */}
      <div
        className="question-area glass-panel"
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span className="badge">
            Question {qIndex + 1} of {questions.length}
          </span>
          <div
            className={`status-indicator ${isSpeaking ? "playing" : ""}`}
            style={{ fontSize: "0.8rem" }}
          >
            {isSpeaking ? "🔊 Speaking..." : "Candidate Turn"}
          </div>
        </div>

        <h2 style={{ fontSize: "2rem", margin: "1rem 0", minHeight: "120px" }}>
          {currentQ ? currentQ.text : "Loading..."}
        </h2>

        <div style={{ marginTop: "auto" }}>
          <button
            onClick={handleNext}
            className="primary-btn"
            disabled={isSpeaking || isTranscribing}
            style={{
              width: "100%",
              marginTop: 0,
              opacity: isSpeaking || isTranscribing ? 0.5 : 1,
              cursor: isSpeaking || isTranscribing ? "not-allowed" : "pointer",
            }}
          >
            {qIndex < questions.length - 1
              ? "Next Question →"
              : "Finish Interview"}
          </button>
        </div>
      </div>

      {/* Right: Camera/Screen Feed */}
      <div
        className="camera-feed glass-panel"
        style={{
          padding: "0",
          overflow: "hidden",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          background: "black",
        }}
      >
        {/* We use muted here because we don't want feedback loop, but the stream has audio */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />

        <div
          className="video-controls"
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            zIndex: 10,
          }}
        >
          <div className="status-indicator recording">
            <span className="pulse-dot"></span> REC
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewSession;
