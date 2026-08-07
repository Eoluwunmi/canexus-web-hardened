"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface DiscoveredSkill {
  skillName: string;
  proficiencyLevel: string;
  confidence: number;
  evidenceSnippet: string;
  source?: "DISCOVERY" | "RESUME";
}

export default function ReviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [skills, setSkills] = useState<DiscoveredSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "discovery" | "resume">("all");

  useEffect(() => {
    if (!sessionId) {
      router.push("/dashboard/applicant/discovery");
    } else {
      fetchExtractedSkills();
    }
  }, [sessionId, router]);

  async function fetchExtractedSkills() {
    try {
      setLoading(true);
      const res = await fetch(`/api/discovery/skills?sessionId=${sessionId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch extracted skills");
      }
      const data = await res.json();
      // Combine discovery and resume skills
      const allSkills = [
        ...(data.discoveredSkills || []),
        ...(data.resumeSkills || []),
      ];
      setSkills(allSkills);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  function removeSkill(idx: number) {
    setSkills(skills.filter((_, i) => i !== idx));
  }

  function updateSkill(idx: number, updates: Partial<DiscoveredSkill>) {
    const updated = [...skills];
    updated[idx] = { ...updated[idx], ...updates };
    setSkills(updated);
  }

  async function handleConfirm() {
    if (!sessionId) return;

    setConfirming(true);
    setError(null);

    try {
      const res = await fetch("/api/discovery/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to confirm skills");
      }

      // Move to confirmation page
      router.push(`/dashboard/applicant/discovery/confirm?sessionId=${sessionId}`);
    } catch (err) {
      setError(String(err));
    } finally {
      setConfirming(false);
    }
  }

  if (!sessionId) {
    return <div>Loading...</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin">⏳ Loading extracted skills...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      {/* Header */}
      <div className="space-y-3">
        <div className="text-sm text-gray-600 font-medium">Step 3 of 4</div>
        <h1 className="text-3xl font-bold">Review Extracted Skills</h1>
        <p className="text-gray-600">
          We found these skills in your narrative. Review and confirm them, or make edits before adding to your passport.
        </p>
      </div>

      {/* Filter Tabs */}
      {skills.some((s) => s.source === "RESUME") && (
        <div className="flex gap-2 border-b pb-3">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 py-2 font-medium text-sm ${
              activeTab === "all"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            All Skills ({skills.length})
          </button>
          <button
            onClick={() => setActiveTab("discovery")}
            className={`px-3 py-2 font-medium text-sm ${
              activeTab === "discovery"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            From Discovery ({skills.filter((s) => s.source === "DISCOVERY").length})
          </button>
          <button
            onClick={() => setActiveTab("resume")}
            className={`px-3 py-2 font-medium text-sm ${
              activeTab === "resume"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            From Resume ({skills.filter((s) => s.source === "RESUME").length})
          </button>
        </div>
      )}

      {/* Skills Table */}
      {skills.length > 0 ? (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Skill</th>
                <th className="px-4 py-3 text-left font-semibold">Proficiency</th>
                <th className="px-4 py-3 text-left font-semibold">Confidence</th>
                <th className="px-4 py-3 text-left font-semibold">Evidence</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {skills
                .filter((s) => {
                  if (activeTab === "discovery") return s.source === "DISCOVERY" || !s.source;
                  if (activeTab === "resume") return s.source === "RESUME";
                  return true;
                })
                .map((skill, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {editingIdx === idx ? (
                        <input
                          type="text"
                          value={skill.skillName}
                          onChange={(e) => updateSkill(idx, { skillName: e.target.value })}
                          className="px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <span className="font-medium">{skill.skillName}</span>
                      )}
                      {skill.source === "RESUME" && (
                        <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                          Resume
                        </span>
                      )}
                      {skill.source === "DISCOVERY" && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          Discovery
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {editingIdx === idx ? (
                      <select
                        value={skill.proficiencyLevel}
                        onChange={(e) => updateSkill(idx, { proficiencyLevel: e.target.value })}
                        className="px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option>BEGINNER</option>
                        <option>INTERMEDIATE</option>
                        <option>ADVANCED</option>
                        <option>EXPERT</option>
                      </select>
                    ) : (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {skill.proficiencyLevel}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${skill.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium">{(skill.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate">
                    {skill.evidenceSnippet}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {editingIdx === idx ? (
                      <button
                        onClick={() => setEditingIdx(null)}
                        className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Done
                      </button>
                    ) : (
                      <button
                        onClick={() => setEditingIdx(idx)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                    )}
                    <button
                      onClick={() => removeSkill(idx)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-4 text-yellow-800">
          <p className="font-semibold">No skills extracted yet</p>
          <p className="text-sm">
            The AI didn't find skills in your narrative. Try adding more detail about specific projects and technologies.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">
          {error}
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4 text-sm space-y-2">
        <p className="font-semibold">💡 Tips:</p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>Edit skills to match your exact experience level</li>
          <li>Remove skills that don't apply to you</li>
          <li>You can add more skills in the next step if needed</li>
        </ul>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={() => router.push(`/dashboard/applicant/discovery/narrative?sessionId=${sessionId}`)}
          className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
        >
          ← Back
        </button>
        <button
          onClick={handleConfirm}
          disabled={confirming || skills.length === 0}
          className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {confirming ? "Processing..." : "Confirm & Continue →"}
        </button>
      </div>
    </div>
  );
}
