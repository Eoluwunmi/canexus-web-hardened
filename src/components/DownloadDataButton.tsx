"use client";

import { useState } from "react";
import { exportUserDataAction } from "@/actions/account";

export default function DownloadDataButton() {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      const data = await exportUserDataAction();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `canexus-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="rounded-md bg-ink text-cream px-4 py-2 text-xs font-medium shrink-0 hover:opacity-90 disabled:opacity-50"
    >
      {busy ? "Preparing…" : "Download my data"}
    </button>
  );
}
