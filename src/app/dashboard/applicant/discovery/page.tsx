"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";

interface DiscoverySession {
  sessionId: string;
  status: string;
  quizResponses?: any;
  narrativeContent?: string;
  linkedResumeParseId?: string;
  createdAt: string;
}

export default function DiscoveryHubPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [session, setSession] = useState<DiscoverySession | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    fetchSession();
  }, []);

  async function fetchSession() {
    try {
      const res = await fetch("/api/discovery/session");
      if (res.ok) {
        const data = await res.json();
        setSession(data);
      }
    } catch (error) {
      console.error("Error fetching discovery session:", error);
    } finally {
      setLoading(false);
    }
  }

  async function startNewDiscovery() {
    try {
      const res = await fetch("/api/discovery/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "quiz",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/dashboard/applicant/discovery/quiz?sessionId=${data.sessionId}`);
      }
    } catch (error) {
      console.error("Error starting discovery:", error);
    }
  }

  function resumeDiscovery() {
    if (session?.sessionId) {
      // Redirect to appropriate step based on what's completed
      const hasQuiz = session.quizResponses;
      const hasNarrative = session.narrativeContent;

      if (!hasQuiz) {
        router.push(`/dashboard/applicant/discovery/quiz?sessionId=${session.sessionId}`);
      } else if (!hasNarrative) {
        router.push(`/dashboard/applicant/discovery/narrative?sessionId=${session.sessionId}`);
      } else {
        router.push(`/dashboard/applicant/discovery/review?sessionId=${session.sessionId}`);
      }
    }
  }

  async function handleResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !session?.sessionId) return;

    setUploading(true);
    setUploadError(null);
    setUploadProgress("Uploading file...");

    try {
      // Step 1: Upload file to S3
      const formData = new FormData();
      formData.append("file", file);

      setUploadProgress("Uploading file to server...");
      const uploadRes = await fetch("/api/resumes/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const data = await uploadRes.json();
        throw new Error(data.error || "Upload failed");
      }

      const uploadData = await uploadRes.json();
      const parseId = uploadData.parseId;

      setUploadProgress("Parsing resume with AI...");

      // Step 2: Wait for parsing to complete (poll status)
      let resumeParseId: string | null = parseId;
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds max wait

      while (attempts < maxAttempts) {
        const statusRes = await fetch(`/api/resumes/${parseId}`);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          // Check if parsing is complete (status is not PENDING)
          if (statusData.status && statusData.status !== "PENDING") {
            resumeParseId = statusData.parseId || parseId;
            break;
          }
        }
        await new Promise((r) => setTimeout(r, 1000));
        attempts++;
      }

      if (!resumeParseId) {
        throw new Error("Resume parsing timed out. Please try again.");
      }

      setUploadProgress("Linking resume to discovery session...");

      // Step 3: Link resume to discovery session
      const linkRes = await fetch("/api/discovery/attach-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.sessionId,
          resumeParseId,
        }),
      });

      if (!linkRes.ok) {
        const data = await linkRes.json();
        throw new Error(data.error || "Failed to link resume");
      }

      setUploadProgress(null);

      // Refresh session and navigate to review
      await fetchSession();
      router.push(`/dashboard/applicant/discovery/review?sessionId=${session.sessionId}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Upload failed";
      setUploadError(errorMsg);
      setUploadProgress(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin">⏳ Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-bold">Discover Your Skills</h1>
        <p className="text-gray-600 text-lg">
          Let's uncover your transferable skills through a guided journey
        </p>
      </div>

      {/* Main CTA */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-8 space-y-4">
        <h2 className="text-2xl font-bold">Ready to discover your talents?</h2>
        <p className="text-gray-700">
          Our interactive discovery process helps you identify and articulate skills you might not even realize you have. Perfect for career changers and those looking to refresh their professional narrative.
        </p>

        {session && session.status === "ACTIVE" ? (
          <button
            onClick={resumeDiscovery}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Resume Your Discovery →
          </button>
        ) : (
          <button
            onClick={startNewDiscovery}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Start Discovery Journey →
          </button>
        )}
      </div>

      {/* Optional Resume Upload */}
      <div className="border border-gray-300 rounded-lg p-8 space-y-4 bg-gray-50">
        <div className="space-y-2">
          <h2 className="text-xl font-bold">Or Upload Your Resume (Optional)</h2>
          <p className="text-gray-700">
            Have an existing resume? Upload it to instantly extract skills and optionally merge them with your discovery results.
          </p>
        </div>
        <div className="border-2 border-dashed border-gray-400 rounded-lg p-8 text-center space-y-3 bg-white">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.doc"
            onChange={handleResumeUpload}
            disabled={uploading}
            className="hidden"
          />

          {uploadProgress ? (
            <div className="space-y-3 py-4">
              <div className="animate-spin">⏳</div>
              <p className="text-sm text-gray-700 font-medium">{uploadProgress}</p>
            </div>
          ) : uploadError ? (
            <div className="space-y-3 py-4">
              <p className="text-sm text-red-600 font-medium">❌ {uploadError}</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition"
              >
                Try Again
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-700 font-medium">
                📄 Click to upload your resume
              </p>
              <p className="text-xs text-gray-500">
                Supports PDF, DOCX, and TXT files
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-block px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Upload Resume
              </button>
            </>
          )}

          <p className="text-xs text-gray-500 pt-2">
            (Resumes uploaded here will be linked to your discovery session)
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-6 bg-white border rounded-lg space-y-3">
          <div className="text-3xl font-bold text-blue-600">1</div>
          <h3 className="font-semibold">Career Quiz</h3>
          <p className="text-sm text-gray-600">
            Answer quick questions about your background and interests
          </p>
        </div>

        <div className="p-6 bg-white border rounded-lg space-y-3">
          <div className="text-3xl font-bold text-blue-600">2</div>
          <h3 className="font-semibold">Your Story</h3>
          <p className="text-sm text-gray-600">
            Describe 2-3 key projects or roles that shaped you
          </p>
        </div>

        <div className="p-6 bg-white border rounded-lg space-y-3">
          <div className="text-3xl font-bold text-blue-600">3</div>
          <h3 className="font-semibold">AI Extraction</h3>
          <p className="text-sm text-gray-600">
            Claude analyzes your narrative to extract relevant skills
          </p>
        </div>

        <div className="p-6 bg-white border rounded-lg space-y-3">
          <div className="text-3xl font-bold text-blue-600">4</div>
          <h3 className="font-semibold">Confirmation</h3>
          <p className="text-sm text-gray-600">
            Review, confirm, and add to your Skills Passport
          </p>
        </div>
      </div>

      {/* Alternative: Manual Entry */}
      <div className="border-t pt-8 space-y-4">
        <h2 className="text-xl font-semibold">Prefer to add skills manually?</h2>
        <p className="text-gray-600">
          You can always go to your Skills Passport and add skills directly.
        </p>
        <button
          onClick={() => router.push("/dashboard/applicant/passport")}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
        >
          Go to Skills Passport →
        </button>
      </div>
    </div>
  );
}
