"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface QuizQuestion {
  id: string;
  question: string;
  type: "text" | "select" | "multiselect";
  options?: string[];
}

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "currentRole",
    question: "What is your current or most recent role/job title?",
    type: "text",
  },
  {
    id: "yearsExp",
    question: "How many years of professional experience do you have?",
    type: "select",
    options: ["0-2", "2-5", "5-10", "10-15", "15+"],
  },
  {
    id: "industry",
    question: "What industry have you worked in primarily?",
    type: "text",
  },
  {
    id: "interests",
    question: "What types of work interest you most? (Select up to 3)",
    type: "multiselect",
    options: [
      "Technical/Engineering",
      "Business/Strategy",
      "Creative/Design",
      "People/HR",
      "Operations",
      "Sales/Marketing",
      "Data/Analytics",
      "Finance",
    ],
  },
  {
    id: "targetRole",
    question: "What role or career path appeals to you? (Optional)",
    type: "text",
  },
  {
    id: "mainChallenge",
    question: "What's your biggest challenge in transitioning careers?",
    type: "text",
  },
];

export default function QuizPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [responses, setResponses] = useState<Record<string, any>>({});
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentQuestion = QUIZ_QUESTIONS[currentQuestionIdx];
  const progress = ((currentQuestionIdx + 1) / QUIZ_QUESTIONS.length) * 100;

  useEffect(() => {
    if (!sessionId) {
      router.push("/dashboard/applicant/discovery");
    }
  }, [sessionId, router]);

  function handleInputChange(value: any) {
    setResponses({
      ...responses,
      [currentQuestion.id]: value,
    });
  }

  function handleNext() {
    if (currentQuestionIdx < QUIZ_QUESTIONS.length - 1) {
      setCurrentQuestionIdx(currentQuestionIdx + 1);
    }
  }

  function handlePrev() {
    if (currentQuestionIdx > 0) {
      setCurrentQuestionIdx(currentQuestionIdx - 1);
    }
  }

  async function handleComplete() {
    if (!sessionId) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/discovery/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          quizResponses: responses,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save quiz responses");
      }

      // Move to narrative step
      router.push(`/dashboard/applicant/discovery/narrative?sessionId=${sessionId}`);
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!sessionId) {
    return <div>Loading...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-8">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Question {currentQuestionIdx + 1} of {QUIZ_QUESTIONS.length}</span>
          <span>{progress.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">{currentQuestion.question}</h2>

        {/* Input based on type */}
        {currentQuestion.type === "text" && (
          <input
            type="text"
            value={responses[currentQuestion.id] || ""}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Your answer..."
            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}

        {currentQuestion.type === "select" && currentQuestion.options && (
          <div className="space-y-2">
            {currentQuestion.options.map((option) => (
              <label key={option} className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name={currentQuestion.id}
                  value={option}
                  checked={responses[currentQuestion.id] === option}
                  onChange={(e) => handleInputChange(e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="ml-3">{option}</span>
              </label>
            ))}
          </div>
        )}

        {currentQuestion.type === "multiselect" && currentQuestion.options && (
          <div className="space-y-2">
            {currentQuestion.options.map((option) => (
              <label key={option} className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={(responses[currentQuestion.id] || []).includes(option)}
                  onChange={(e) => {
                    const current = responses[currentQuestion.id] || [];
                    const updated = e.target.checked
                      ? [...current, option]
                      : current.filter((v: string) => v !== option);
                    handleInputChange(updated);
                  }}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="ml-3">{option}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-4">
        <button
          onClick={handlePrev}
          disabled={currentQuestionIdx === 0}
          className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← Previous
        </button>

        {currentQuestionIdx < QUIZ_QUESTIONS.length - 1 ? (
          <button
            onClick={handleNext}
            className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Next →
          </button>
        ) : (
          <button
            onClick={handleComplete}
            disabled={submitting}
            className="flex-1 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Complete Quiz →"}
          </button>
        )}
      </div>

      {/* Skip option */}
      <div className="text-center text-sm text-gray-600">
        <button
          onClick={() => router.push(`/dashboard/applicant/discovery/narrative?sessionId=${sessionId}`)}
          className="text-blue-600 hover:underline"
        >
          Skip to next step
        </button>
      </div>
    </div>
  );
}
