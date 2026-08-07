"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface NarrativeMetadata {
  projectType?: string;
  timeline?: string;
  teamSize?: string;
  industry?: string;
  technologies?: string;
}

export default function NarrativePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [narrative, setNarrative] = useState("");
  const [metadata, setMetadata] = useState<NarrativeMetadata>({});
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      router.push("/dashboard/applicant/discovery");
    }
  }, [sessionId, router]);

  async function handleContinue() {
    if (!narrative.trim()) {
      setError("Please describe your experience before continuing");
      return;
    }

    setExtracting(true);
    setError(null);

    try {
      // Call extraction endpoint
      const res = await fetch("/api/discovery/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          narrativeContent: narrative,
          narrativeMetadata: metadata,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to extract skills from narrative");
      }

      // Move to review step
      router.push(`/dashboard/applicant/discovery/review?sessionId=${sessionId}`);
    } catch (err) {
      setError(String(err));
    } finally {
      setExtracting(false);
    }
  }

  if (!sessionId) {
    return <div>Loading...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-8">
      {/* Header */}
      <div className="space-y-3">
        <div className="text-sm text-gray-600 font-medium">Step 2 of 4</div>
        <h1 className="text-3xl font-bold">Tell Your Story</h1>
        <p className="text-gray-600">
          Describe 2-3 key projects or roles where you developed important skills.
          The more detail you provide, the better we can extract relevant skills.
        </p>
      </div>

      {/* Example */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm space-y-2">
        <p className="font-semibold">💡 Example format:</p>
        <p className="text-gray-700">
          "I led a cross-functional team to build a mobile app that increased user engagement by 40%.
          I used Python and PostgreSQL for the backend, React for the frontend, and managed a team of 3 developers.
          The project took 6 months and involved coordinating with design, product, and operations teams..."
        </p>
      </div>

      {/* Main textarea */}
      <div className="space-y-3">
        <label className="block font-semibold">Your Experience Narrative</label>
        <textarea
          value={narrative}
          onChange={(e) => setNarrative(e.target.value)}
          placeholder="Describe your key projects and roles here. Include context, outcomes, and technologies used..."
          className="w-full h-64 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
        />
        <div className="text-sm text-gray-600">
          {narrative.length} characters
        </div>
      </div>

      {/* Optional metadata */}
      <div className="space-y-4">
        <h3 className="font-semibold">Optional Context (helps AI extract better skills)</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Project Type</label>
            <input
              type="text"
              value={metadata.projectType || ""}
              onChange={(e) => setMetadata({ ...metadata, projectType: e.target.value })}
              placeholder="e.g., Web App, Data Pipeline, Team Management"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Timeline</label>
            <input
              type="text"
              value={metadata.timeline || ""}
              onChange={(e) => setMetadata({ ...metadata, timeline: e.target.value })}
              placeholder="e.g., 6 months, 2 years"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Team Size</label>
            <input
              type="text"
              value={metadata.teamSize || ""}
              onChange={(e) => setMetadata({ ...metadata, teamSize: e.target.value })}
              placeholder="e.g., Solo, Team of 5, 20+ people"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Industry/Domain</label>
            <input
              type="text"
              value={metadata.industry || ""}
              onChange={(e) => setMetadata({ ...metadata, industry: e.target.value })}
              placeholder="e.g., FinTech, Healthcare, E-commerce"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Key Technologies/Tools (comma-separated)</label>
          <input
            type="text"
            value={metadata.technologies || ""}
            onChange={(e) => setMetadata({ ...metadata, technologies: e.target.value })}
            placeholder="e.g., Python, React, PostgreSQL, AWS, Jira"
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={() => router.push(`/dashboard/applicant/discovery/quiz?sessionId=${sessionId}`)}
          className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
        >
          ← Back
        </button>
        <button
          onClick={handleContinue}
          disabled={extracting || !narrative.trim()}
          className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {extracting ? "Extracting skills..." : "Continue to Review →"}
        </button>
      </div>

      {/* Info note */}
      <div className="text-center text-sm text-gray-600 bg-gray-50 rounded p-4">
        <p>💬 Your narrative is analyzed by AI to extract relevant skills. You'll review and confirm them next.</p>
      </div>
    </div>
  );
}
