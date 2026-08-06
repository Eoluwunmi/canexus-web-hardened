"use client";

import { useState, useCallback } from "react";
import {
  requestEvidenceUploadAction,
  confirmEvidenceUploadAction,
  deleteEvidenceFileAction,
  getEvidenceDownloadUrlAction,
  listEvidenceFilesAction,
} from "@/actions/evidence";

type EvidenceFile = { id: string; fileName: string; mimeType: string; sizeBytes: number; uploadedAt: Date };

const ACCEPT = ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";
const MAX_BYTES = 10 * 1024 * 1024;

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function EvidenceFileManager({ userSkillId, initialFiles }: { userSkillId: string; initialFiles: EvidenceFile[] }) {
  const [files, setFiles] = useState<EvidenceFile[]>(initialFiles);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const rows = await listEvidenceFilesAction(userSkillId);
    setFiles(rows);
  }, [userSkillId]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    setError("");

    if (file.size > MAX_BYTES) {
      setError("Files must be under 10MB.");
      return;
    }
    if (files.length >= 5) {
      setError("A skill can have at most 5 attached files.");
      return;
    }

    setUploading(true);
    try {
      const { post, storageKey } = await requestEvidenceUploadAction({
        userSkillId,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });

      const formData = new FormData();
      Object.entries(post.fields).forEach(([k, v]) => formData.append(k, v as string));
      formData.append("file", file);

      const uploadRes = await fetch(post.url, { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("Upload to storage failed. Please try again.");

      await confirmEvidenceUploadAction({ userSkillId, storageKey, fileName: file.name });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(fileId: string) {
    setBusyId(fileId);
    setError("");
    try {
      await deleteEvidenceFileAction(fileId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete that file");
    } finally {
      setBusyId(null);
    }
  }

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
    <div className="mt-3 space-y-2">
      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 text-xs bg-paper-dim rounded-md px-3 py-1.5">
              <span className="font-mono truncate min-w-0">{f.fileName} <span className="text-ink-soft">({formatSize(f.sizeBytes)})</span></span>
              <span className="flex items-center gap-3 shrink-0">
                <button onClick={() => handleView(f.id)} disabled={busyId === f.id} className="text-stamp hover:underline disabled:opacity-50">
                  View
                </button>
                <button onClick={() => handleDelete(f.id)} disabled={busyId === f.id} className="text-ink-soft hover:underline disabled:opacity-50">
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-stamp">{error}</p>}
      {files.length < 5 && (
        <label className="inline-block text-xs text-stamp font-medium cursor-pointer hover:underline">
          {uploading ? "Uploading…" : "+ Attach a file (PDF, PNG, or JPEG, up to 10MB)"}
          <input type="file" accept={ACCEPT} onChange={handleFileSelect} disabled={uploading} className="hidden" />
        </label>
      )}
    </div>
  );
}
