/**
 * Resume Review Detail Page
 * Split-view: extracted fields on left, actions on right
 * Supports inline editing and approval.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ParsedResume {
  parseId: string;
  resumeId: string;
  fileName: string;
  fileFormat: string;
  status: string;
  extractedData: any;
  overallConfidence: number;
  fieldConfidence: Record<string, number>;
  needsReview: boolean;
  reviewReasons: string[];
  corrections: any[];
  uploadedAt: string;
  parsedAt: string;
}

interface EditField {
  fieldPath: string;
  value: string;
  originalValue: string;
  notes: string;
}

export default function ResumeDetailPage({
  params,
}: {
  params: { parseId: string };
}) {
  const router = useRouter();
  const { parseId } = params;

  const [resume, setResume] = useState<ParsedResume | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<EditField | null>(null);
  const [approving, setApproving] = useState(false);
  const [approvalSuccess, setApprovalSuccess] = useState(false);

  useEffect(() => {
    fetchResume();
  }, [parseId]);

  async function fetchResume() {
    try {
      setLoading(true);
      const res = await fetch(`/api/resumes/${parseId}`);

      if (!res.ok) {
        throw new Error(`Failed to fetch resume: ${res.statusText}`);
      }

      const data = await res.json();
      setResume(data);
    } catch (err) {
      setError(String(err));
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveCorrection() {
    if (!editingField || !resume) return;

    try {
      const res = await fetch(`/api/resumes/${parseId}/corrections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldPath: editingField.fieldPath,
          originalValue: editingField.originalValue,
          correctedValue: editingField.value,
          notes: editingField.notes,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save correction");
      }

      // Refresh resume data
      await fetchResume();
      setEditingField(null);
    } catch (err) {
      alert(`Error saving correction: ${err}`);
    }
  }

  async function handleApprove() {
    if (!resume) return;

    try {
      setApproving(true);

      const res = await fetch(`/api/resumes/${parseId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          includeSkills: true,
          includeExperience: true,
          includeEducation: true,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.details || "Failed to approve");
      }

      setApprovalSuccess(true);
      await fetchResume();

      // Redirect after success
      setTimeout(() => {
        router.push("/dashboard/admin/resume-review?filter=completed");
      }, 2000);
    } catch (err) {
      alert(`Error approving resume: ${err}`);
    } finally {
      setApproving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin">⏳ Loading resume...</div>
      </div>
    );
  }

  if (error || !resume) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded">
        <h2 className="text-red-800 font-semibold">Error</h2>
        <p className="text-red-700">{error || "Resume not found"}</p>
      </div>
    );
  }

  const confidencePercent = (resume.overallConfidence * 100).toFixed(0);
  const confidenceColor =
    resume.overallConfidence >= 0.85 ? "text-green-600" : "text-yellow-600";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold">{resume.fileName}</h1>
          <p className="text-gray-600 mt-2">
            Parsed on {new Date(resume.parsedAt).toLocaleString()}
          </p>
        </div>

        <div className="text-right">
          <div className={`text-3xl font-bold ${confidenceColor}`}>
            {confidencePercent}%
          </div>
          <p className="text-sm text-gray-600">Overall Confidence</p>
        </div>
      </div>

      {/* Success Message */}
      {approvalSuccess && (
        <div className="bg-green-50 border border-green-200 rounded p-4">
          <p className="text-green-800 font-semibold">
            ✅ Resume approved and synced to Skills Passport!
          </p>
          <p className="text-green-700 text-sm mt-1">Redirecting...</p>
        </div>
      )}

      {/* Review Warnings */}
      {resume.needsReview && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
          <p className="text-yellow-800 font-semibold">⚠️ Needs Review</p>
          <ul className="text-yellow-700 text-sm mt-2 space-y-1">
            {resume.reviewReasons.map((reason, idx) => (
              <li key={idx}>• {reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Extracted Fields */}
        <div className="space-y-6">
          <div className="bg-white border rounded p-6 space-y-6">
            <h2 className="text-xl font-bold">Extracted Data</h2>

            {/* Identity */}
            {resume.extractedData?.identity && (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Identity</h3>

                {resume.extractedData.identity.full_name && (
                  <FieldEditor
                    label="Full Name"
                    fieldPath="identity.full_name"
                    value={resume.extractedData.identity.full_name}
                    confidence={
                      resume.fieldConfidence["identity.full_name"] || 0
                    }
                    isEditing={
                      editingField?.fieldPath === "identity.full_name"
                    }
                    onEdit={(value, notes) =>
                      setEditingField({
                        fieldPath: "identity.full_name",
                        value,
                        originalValue:
                          resume.extractedData.identity.full_name,
                        notes,
                      })
                    }
                    onSave={handleSaveCorrection}
                    editingField={editingField}
                  />
                )}

                {resume.extractedData.identity.emails?.[0] && (
                  <FieldEditor
                    label="Email"
                    fieldPath="identity.emails[0]"
                    value={resume.extractedData.identity.emails[0]}
                    confidence={
                      resume.fieldConfidence["identity.emails[0]"] || 0
                    }
                    isEditing={
                      editingField?.fieldPath === "identity.emails[0]"
                    }
                    onEdit={(value, notes) =>
                      setEditingField({
                        fieldPath: "identity.emails[0]",
                        value,
                        originalValue:
                          resume.extractedData.identity.emails[0],
                        notes,
                      })
                    }
                    onSave={handleSaveCorrection}
                    editingField={editingField}
                  />
                )}
              </div>
            )}

            {/* Experience Summary */}
            {resume.extractedData?.experience?.length > 0 && (
              <div className="space-y-3 pt-4 border-t">
                <h3 className="font-semibold text-lg">Experience</h3>
                {resume.extractedData.experience.slice(0, 2).map((exp: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 bg-gray-50 rounded border border-gray-200"
                  >
                    <p className="font-medium">{exp.title}</p>
                    <p className="text-sm text-gray-600">{exp.employer}</p>
                    <p className="text-xs text-gray-500">
                      {exp.start} – {exp.end || "present"}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Skills Summary */}
            {resume.extractedData?.skills?.length > 0 && (
              <div className="space-y-2 pt-4 border-t">
                <h3 className="font-semibold text-lg">Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {resume.extractedData.skills.slice(0, 5).map((skill: any, idx: number) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                    >
                      {skill.name}
                    </span>
                  ))}
                  {resume.extractedData.skills.length > 5 && (
                    <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">
                      +{resume.extractedData.skills.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions & Controls */}
        <div className="space-y-4">
          {/* Action Buttons */}
          <div className="bg-white border rounded p-6 space-y-3">
            <h2 className="text-lg font-bold">Actions</h2>

            <button
              onClick={handleApprove}
              disabled={approving || approvalSuccess}
              className={`w-full px-4 py-3 rounded font-semibold transition ${
                approving || approvalSuccess
                  ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                  : "bg-green-600 text-white hover:bg-green-700"
              }`}
            >
              {approving ? "Approving..." : "✅ Approve & Sync to Passport"}
            </button>

            <button
              onClick={() => router.back()}
              className="w-full px-4 py-3 rounded font-semibold bg-gray-200 text-gray-800 hover:bg-gray-300 transition"
            >
              ← Back to Queue
            </button>
          </div>

          {/* Corrections Log */}
          {resume.corrections.length > 0 && (
            <div className="bg-white border rounded p-6 space-y-3">
              <h2 className="text-lg font-bold">Corrections Made</h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {resume.corrections.map((correction, idx) => (
                  <div key={idx} className="text-sm p-2 bg-gray-50 rounded border border-gray-200">
                    <p className="font-mono text-xs text-gray-600">
                      {correction.fieldPath}
                    </p>
                    <p className="text-gray-700 mt-1">
                      "{correction.correctedValue}"
                    </p>
                    {correction.notes && (
                      <p className="text-xs text-gray-500 mt-1">
                        Note: {correction.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="bg-gray-50 border rounded p-4 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Parse ID:</span>
              <span className="font-mono text-xs">{parseId.slice(0, 8)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className="font-semibold">{resume.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Uploaded:</span>
              <span>{new Date(resume.uploadedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Field Editor Component
 */
function FieldEditor({
  label,
  fieldPath,
  value,
  confidence,
  isEditing,
  onEdit,
  onSave,
  editingField,
}: {
  label: string;
  fieldPath: string;
  value: string;
  confidence: number;
  isEditing: boolean;
  onEdit: (value: string, notes: string) => void;
  onSave: () => void;
  editingField: any;
}) {
  const confidencePercent = (confidence * 100).toFixed(0);
  const confidenceColor =
    confidence >= 0.9
      ? "text-green-600 bg-green-50"
      : confidence >= 0.8
        ? "text-yellow-600 bg-yellow-50"
        : "text-red-600 bg-red-50";

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="font-medium text-gray-700">{label}</label>
        <div className={`px-2 py-1 rounded text-xs font-semibold ${confidenceColor}`}>
          {confidencePercent}%
        </div>
      </div>

      {isEditing && editingField ? (
        <div className="space-y-2 bg-blue-50 p-3 rounded border border-blue-200">
          <input
            type="text"
            value={editingField.value}
            onChange={(e) =>
              onEdit(e.target.value, editingField.notes)
            }
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={editingField.originalValue}
            autoFocus
          />
          <textarea
            value={editingField.notes}
            onChange={(e) => onEdit(editingField.value, e.target.value)}
            className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Notes (optional)"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              onClick={onSave}
              className="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700"
            >
              Save
            </button>
            <button
              onClick={() => onEdit("", "")}
              className="flex-1 px-3 py-2 bg-gray-300 text-gray-700 rounded text-sm font-semibold hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-gray-50 rounded border border-gray-200">
          <p className="text-gray-800 break-words">{value}</p>
          <button
            onClick={() => onEdit(value, "")}
            className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
