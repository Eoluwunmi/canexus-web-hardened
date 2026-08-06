"use client";

import { useState } from "react";
import { getEvidenceDownloadUrlAction } from "@/actions/evidence";

type EvidenceFile = { id: string; fileName: string; sizeBytes: number };

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminFileViewer({ files }: { files: EvidenceFile[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (files.length === 0) return null;

  async function handleView(fileId: string) {
    setBusyId(fileId);
    setError("");
    try {
      const { url } = await getEvidenceDownloadUrlAction(fileId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open that file");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-2">
      <ul className="flex flex-wrap gap-2">
        {files.map((f) => (
          <li key={f.id}>
            <button
              onClick={() => handleView(f.id)}
              disabled={busyId === f.id}
              className="text-xs font-mono bg-paper-dim rounded-md px-2 py-1 hover:bg-paper disabled:opacity-50"
            >
              📎 {f.fileName} ({formatSize(f.sizeBytes)})
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="text-xs text-stamp mt-1">{error}</p>}
    </div>
  );
}
