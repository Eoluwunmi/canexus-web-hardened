/**
 * Resume Review Queue Page
 * Shows list of resumes pending review with filters.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface ReviewQueueItem {
  parseId: string;
  resumeId: string;
  fileName: string;
  status: string;
  overallConfidence: number;
  needsReview: boolean;
  parsedAt: string;
  uploadedAt: string;
}

interface ReviewQueueResponse {
  data: ReviewQueueItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filter: string;
  confidenceThreshold: number;
}

type Filter = "needs_review" | "low_confidence" | "failed" | "completed";

export default function ResumeReviewPage() {
  const [queue, setQueue] = useState<ReviewQueueResponse | null>(null);
  const [filter, setFilter] = useState<Filter>("needs_review");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchQueue();
  }, [filter, page]);

  async function fetchQueue() {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        filter,
        page: String(page),
        limit: "20",
        confidence_threshold: "0.85",
      });

      const res = await fetch(`/api/resumes/review-queue?${params}`);

      if (!res.ok) {
        throw new Error(`Failed to fetch queue: ${res.statusText}`);
      }

      const data = await res.json();
      setQueue(data);
    } catch (err) {
      setError(String(err));
      console.error("Queue fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin">⏳ Loading review queue...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded">
        <h2 className="text-red-800 font-semibold">Error</h2>
        <p className="text-red-700">{error}</p>
        <button
          onClick={() => fetchQueue()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!queue) {
    return <div>No data available</div>;
  }

  const filters: { value: Filter; label: string; count?: number }[] = [
    { value: "needs_review", label: "Needs Review" },
    { value: "low_confidence", label: "Low Confidence (<85%)" },
    { value: "failed", label: "Failed" },
    { value: "completed", label: "Completed" },
  ];

  const confidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return "text-green-600 bg-green-50";
    if (confidence >= 0.8) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  const statusBadgeColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "NEEDS_REVIEW":
        return "bg-yellow-100 text-yellow-800";
      case "FAILED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Resume Review Queue</h1>
        <p className="text-gray-600 mt-2">
          Review parsed resumes and approve to sync to Skills Passport
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 border-b border-gray-200 pb-4">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setFilter(f.value);
              setPage(1);
            }}
            className={`px-4 py-2 rounded font-medium transition ${
              filter === f.value
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <p className="text-sm text-blue-900">
          Showing {queue.data.length} of {queue.pagination.total} resumes
          {queue.filter === "needs_review"
            ? " that need review"
            : ` (${queue.filter})`}
        </p>
      </div>

      {/* Queue Table */}
      <div className="overflow-x-auto border border-gray-200 rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left font-semibold">Filename</th>
              <th className="px-6 py-3 text-left font-semibold">Status</th>
              <th className="px-6 py-3 text-left font-semibold">Confidence</th>
              <th className="px-6 py-3 text-left font-semibold">Parsed</th>
              <th className="px-6 py-3 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {queue.data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-600">
                  No resumes in this queue
                </td>
              </tr>
            ) : (
              queue.data.map((item) => (
                <tr key={item.parseId} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm text-gray-700">
                      {item.fileName}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadgeColor(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className={`px-3 py-1 rounded text-xs font-semibold ${confidenceColor(item.overallConfidence)}`}>
                      {(item.overallConfidence * 100).toFixed(0)}%
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-600">
                    {new Date(item.parsedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/dashboard/admin/resume-review/${item.parseId}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Review →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {queue.pagination.totalPages > 1 && (
        <div className="flex gap-2 items-center justify-center">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
          >
            ← Prev
          </button>

          {Array.from({ length: queue.pagination.totalPages }, (_, i) => i + 1)
            .slice(
              Math.max(0, page - 2),
              Math.min(queue.pagination.totalPages, page + 1)
            )
            .map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`px-3 py-1 rounded ${
                  p === page
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                {p}
              </button>
            ))}

          <button
            onClick={() =>
              setPage(Math.min(queue.pagination.totalPages, page + 1))
            }
            disabled={page === queue.pagination.totalPages}
            className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
