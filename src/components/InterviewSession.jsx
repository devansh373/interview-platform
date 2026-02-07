import { useState, useRef, useEffect } from "react";
import { useTextToSpeech } from "../hooks/useTextToSpeech";
import { useVideoRecorder } from "../hooks/useVideoRecorder";
import { useSegmentRecorder } from "../hooks/useSegmentRecorder";
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

  const { speak, cancel, audioStream } = useTextToSpeech();

  const {
    stream,
    startRecordingFlow,
    stopRecording,
    recordedChunks,
    isRecording,
    error: videoError,
  } = useVideoRecorder();

  const {
    segments,
    startSegment,
    stopSegment,
    addSegment,
    downloadSegments,
    
  } = useSegmentRecorder();

  // Handle stream mounting
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const playQuestion = (text, index) => {
    setIsSpeaking(true);

    speak(text, (audioBlob) => {
      setIsSpeaking(false);

      // Save the question audio blob
      if (audioBlob) {
        addSegment("question", index, audioBlob);
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

  const handleNext = () => {
    cancel(); // Stop current speech

    // Stop recording the current answer
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

  const finishInterview = () => {
    cancel();

    // Stop any ongoing answer recording
    if (isAnswering) {
      stopSegment();
      setIsAnswering(false);
    }

    stopRecording();
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

  const downloadAll = () => {
    // Download full video
    downloadVideo();

    // Download all question and answer segments
    downloadSegments();
  };

  if (currentStep === Step.COMPLETED) {
    return (
      <div
        className="glass-panel"
        style={{ textAlign: "center", maxWidth: "600px", margin: "0 auto" }}
      >
        <h2>Interview Completed!</h2>
        <p>Your full session has been recorded.</p>
        <p
          style={{ color: "#a5b4fc", fontSize: "0.9rem", marginTop: "0.5rem" }}
        >
          {segments.length} audio segments recorded (
          {segments.filter((s) => s.type === "question").length} questions,{" "}
          {segments.filter((s) => s.type === "answer").length} answers)
        </p>
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
            onClick={downloadAll}
            className="primary-btn"
            style={{ marginTop: 0 }}
          >
            Download All Files
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
            Video Only
          </button>
          <button
            onClick={downloadSegments}
            style={{
              padding: "1rem",
              background: "transparent",
              border: "1px solid #3f3f46",
              cursor: "pointer",
              color: "white",
              borderRadius: "12px",
            }}
          >
            Segments Only
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
            New Session
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
      }}
    >
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
            disabled={isSpeaking}
            style={{
              width: "100%",
              marginTop: 0,
              opacity: isSpeaking ? 0.5 : 1,
              cursor: isSpeaking ? "not-allowed" : "pointer",
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
