export const questions = [
  {
    id: 1,
    text: "Where are you from originally?",
  },
  {
    id: 2,
    text: "When was the last time you argued with someone, and what was it about?",
  },
  {
    id: 3,
    text: "How are you at controlling your temper?",
  },
  {
    id: 4,
    text: "What are you most proud of in your life?",
  },
  {
    id: 5,
    text: "How easy is it for you to get a good night's sleep?",
  },
  {
    id: 6,
    text: "So, how are you doing today?",
  },
  {
    id: 7,
    text: "Have you ever been diagnosed with PTSD?",
  },
  {
    id: 8,
    text: "Have you been diagnosed with depression?",
  },
  {
    id: 9,
    text: "How have you been feeling lately?",
  },
  {
    id: 10,
    text: "What are some things you really like about LA?",
  },
  {
    id: 11,
    text: "Who's someone that's been a positive influence in your life?",
  },
  {
    id: 12,
    text: "Is there anything you regret?",
  },
  {
    id: 13,
    text: "How would your best friend describe you?",
  },
  {
    id: 14,
    text: "What motivates you to keep going during difficult times?",
  },
];

/**
 * Randomly selects 7 questions from the questions array
 * @returns {Array} Array of 7 randomly selected questions
 */
export const getRandomQuestions = () => {
  // Create a copy of the questions array to avoid mutating the original
  const shuffled = [...questions];

  // Fisher-Yates shuffle algorithm
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Return the first 7 questions
  return shuffled.slice(0, 7);
};
