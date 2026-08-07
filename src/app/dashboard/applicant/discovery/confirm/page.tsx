"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ConfirmPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      router.push("/dashboard/applicant/discovery");
    } else {
      // Mark session as completed in the background
      markSessionCompleted();
    }
  }, [sessionId, router]);

  async function markSessionCompleted() {
    try {
      setLoading(false);
      // Session was already marked completed in the /api/discovery/confirm endpoint
      setSuccessMessage("Your skills have been added to your Passport!");
    } catch (err) {
      console.error("Error:", err);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin">⏳ Finalizing...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      {/* Success Message */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-8 space-y-4 text-center">
        <div className="text-5xl">✅</div>
        <h1 className="text-3xl font-bold text-green-900">Discovery Complete!</h1>
        <p className="text-green-700 text-lg">{successMessage}</p>
      </div>

      {/* Next Steps */}
      <div className="bg-white border rounded-lg p-8 space-y-6">
        <h2 className="text-2xl font-bold">What's Next?</h2>

        <div className="space-y-4">
          <div className="border-l-4 border-blue-600 pl-4 py-2 space-y-2">
            <h3 className="font-semibold">1. Review Your Skills Passport</h3>
            <p className="text-gray-600">
              Your newly discovered skills are now in your passport with "Evidence-Linked" verification level.
              You can edit them or add more details at any time.
            </p>
          </div>

          <div className="border-l-4 border-blue-600 pl-4 py-2 space-y-2">
            <h3 className="font-semibold">2. Improve Your Match Score</h3>
            <p className="text-gray-600">
              With more verified skills, your match score with relevant jobs will improve.
              Employers can now see a more complete picture of your capabilities.
            </p>
          </div>

          <div className="border-l-4 border-blue-600 pl-4 py-2 space-y-2">
            <h3 className="font-semibold">3. Target Your Career Path</h3>
            <p className="text-gray-600">
              Use your AI Coach to explore which roles are the best fit based on your skills.
              You can also identify skill gaps for your target career.
            </p>
          </div>

          <div className="border-l-4 border-blue-600 pl-4 py-2 space-y-2">
            <h3 className="font-semibold">4. Continuous Learning</h3>
            <p className="text-gray-600">
              Share your passport with mentors or employers, and run another discovery session
              as you gain new skills and experience.
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-4">
        <button
          onClick={() => router.push("/dashboard/applicant/passport")}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
        >
          Go to Your Skills Passport →
        </button>

        <button
          onClick={() => router.push("/dashboard/applicant/coach")}
          className="w-full px-6 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition"
        >
          Explore with AI Coach →
        </button>

        <button
          onClick={() => router.push("/dashboard")}
          className="w-full px-6 py-3 bg-gray-100 text-gray-800 rounded-lg font-semibold hover:bg-gray-200 transition"
        >
          Back to Dashboard
        </button>
      </div>

      {/* Tips */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-6 space-y-3">
        <h3 className="font-semibold">💡 Pro Tips:</h3>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>Run discovery again later to add skills from new projects or roles</li>
          <li>Upload your resume to verify and import additional skills</li>
          <li>Set skills to "Visible to Employers" so they can see your capabilities</li>
          <li>Use evidence files (certificates, portfolios) to boost verification level</li>
        </ul>
      </div>
    </div>
  );
}
