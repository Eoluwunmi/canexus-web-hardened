"use client";

import { useState } from "react";

const TYPE_LABELS: Record<string, string> = {
  JOB: "Job",
  CO_OP: "Co-op",
  INTERNSHIP: "Internship",
  MICRO_INTERNSHIP: "Micro-internship",
  APPRENTICESHIP: "Apprenticeship",
  PRACTICUM: "Practicum",
};

export default function JobTypeFields() {
  const [opportunityType, setOpportunityType] = useState("JOB");
  const isWorkIntegratedLearning = opportunityType !== "JOB";

  return (
    <>
      <div>
        <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Opportunity type</label>
        <select
          name="opportunityType"
          value={opportunityType}
          onChange={(e) => setOpportunityType(e.target.value)}
          className="rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm"
        >
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {isWorkIntegratedLearning && (
        <div className="grid sm:grid-cols-2 gap-4 bg-paper-dim rounded-md p-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Duration (weeks)</label>
            <input name="durationWeeks" type="number" min={1} max={260} placeholder="e.g. 12"
              className="w-full rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm self-end pb-2.5">
            <input name="isCreditEligible" type="checkbox" className="rounded border-paper-dim" />
            Eligible for academic credit
          </label>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Hours / week</label>
          <input name="estimatedHoursPerWeek" type="number" min={1} max={168} placeholder="e.g. 35"
            className="w-full rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Application deadline</label>
          <input name="applicationDeadline" type="date" className="w-full rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Paid?</label>
          <select name="isPaid" defaultValue="" className="w-full rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm">
            <option value="">Not specified</option>
            <option value="true">Paid</option>
            <option value="false">Unpaid</option>
          </select>
        </div>
      </div>
    </>
  );
}
