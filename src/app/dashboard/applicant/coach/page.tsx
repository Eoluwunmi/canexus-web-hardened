"use client";

import { useState } from "react";

type Msg = { role: "user" | "coach"; text: string; groundedIn?: string[] };

const starters = [
  "What careers could I realistically move into?",
  "What's the shortest path to my top match?",
  "What skill should I focus on learning next?",
];

export default function CoachPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showWhy, setShowWhy] = useState<number | null>(null);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((m) => [...m, { role: "coach", text: data.error || "Something went wrong. Please try again." }]);
      } else {
        setMessages((m) => [...m, { role: "coach", text: data.text, groundedIn: data.groundedIn }]);
      }
    } catch {
      setMessages((m) => [...m, { role: "coach", text: "The Coach is temporarily unavailable. Please try again shortly." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl font-semibold text-ink mb-1">AI Career Coach</h1>
      <p className="text-ink-soft mb-6">Grounded in your real Skills Passport — not generic advice.</p>

      <div className="paper-card rounded-lg flex flex-col h-[560px]">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-ink-soft">Try asking:</p>
              {starters.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="block text-left text-sm px-3 py-2 rounded-md border border-paper-dim hover:border-stamp transition-colors w-full"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-lg px-4 py-3 text-sm whitespace-pre-line ${
                m.role === "user" ? "bg-ink text-cream" : "bg-paper-dim text-ink"
              }`}>
                {m.text}
                {m.role === "coach" && m.groundedIn && (
                  <div className="mt-2">
                    <button
                      onClick={() => setShowWhy(showWhy === i ? null : i)}
                      className="text-xs text-stamp font-mono underline"
                    >
                      why am I seeing this?
                    </button>
                    {showWhy === i && (
                      <ul className="mt-2 text-xs text-ink-soft list-disc list-inside space-y-1">
                        {m.groundedIn.map((g, gi) => <li key={gi}>{g}</li>)}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && <p className="text-xs text-ink-soft font-mono">Coach is thinking…</p>}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="border-t border-paper-dim p-3 flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your career options…"
            className="flex-1 rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm"
          />
          <button type="submit" disabled={loading} className="rounded-md bg-stamp text-cream px-4 py-2 text-sm font-medium disabled:opacity-50">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
