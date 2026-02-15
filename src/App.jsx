import { useState, useMemo } from "react";
import "./index.css";
import "./App.css";
import InterviewSession from "./components/InterviewSession";
import { getRandomQuestions } from "./data/questions";

function App() {
  const [activeFeature, setActiveFeature] = useState(0);
  const [started, setStarted] = useState(false);

  // Generate 7 random questions when the assessment starts
  const randomQuestions = useMemo(() => getRandomQuestions(), []);

  // If assessment started, show the session
  if (started) {
    return <InterviewSession questions={randomQuestions} />;
  }

  const features = [
    {
      title: "Audio Guided",
      description: "Questions are read aloud in a calm, supportive manner.",
      icon: "🎧",
    },
    {
      title: "Video Recording",
      description: "Securely capture your responses for clinical analysis.",
      icon: "📹",
    },
    {
      title: "Comprehensive Analysis",
      description:
        "Receive detailed insights on anxiety, depression, and stress levels.",
      icon: "📊",
    },
  ];

  return (
    <>
      <div className="animate-fade-in" style={{ paddingTop: "2rem" }}>
        {/* <span className="badge">Mental Health Assessment</span> */}
        <h1>
          Your <span style={{ color: "#818cf8" }}>Mental Wellness</span>
          <br />
          Matters
        </h1>
        <p>
          A confidential, guided assessment to evaluate anxiety, depression, and
          stress levels. Answer questions at your own pace in a safe, supportive
          environment.
        </p>
        <div
          style={{
            display: "flex",
            gap: "1rem",
            justifyContent: "center",
            marginTop: "2rem",
          }}
        >
          <button onClick={() => setStarted(true)}>Begin Assessment</button>
          <button
            style={{ background: "transparent", border: "1px solid #3f3f46" }}
          >
            Learn More
          </button>
        </div>
      </div>

      <div className="grid-features animate-fade-in delay-200">
        {features.map((feature, index) => (
          <div
            key={index}
            className="glass-panel"
            onMouseEnter={() => setActiveFeature(index)}
            style={{
              borderColor:
                activeFeature === index
                  ? "var(--accent)"
                  : "var(--glass-border)",
            }}
          >
            <div className="feature-icon">{feature.icon}</div>
            <h3
              style={{ margin: "0 0 0.5rem 0", color: "var(--text-primary)" }}
            >
              {feature.title}
            </h3>
            <p style={{ margin: 0, fontSize: "0.95rem", maxWidth: "100%" }}>
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}

export default App;
