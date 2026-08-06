import { createJobAction } from "@/actions/jobs";
import { redirect } from "next/navigation";
import JobTypeFields from "@/components/JobTypeFields";

export default function NewJobPage() {
  async function action(formData: FormData) {
    "use server";
    await createJobAction(formData);
    redirect("/dashboard/employer");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Post a job</h1>
        <p className="text-ink-soft mt-1">Skills-based postings map to the same taxonomy as every applicant&apos;s Passport.</p>
      </div>

      <form action={action} className="paper-card rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Job title</label>
          <input name="title" required maxLength={200} className="w-full rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Description</label>
          <textarea name="description" required rows={5} maxLength={5000} className="w-full rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Location</label>
          <input name="location" maxLength={200} placeholder="e.g. Calgary, AB (hybrid)" className="w-full rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Required skills (comma-separated)</label>
          <input name="requiredSkills" required placeholder="e.g. Project management, Stakeholder communication" className="w-full rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Preferred skills (comma-separated, optional)</label>
          <input name="preferredSkills" placeholder="e.g. Data analysis" className="w-full rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm" />
        </div>
        <JobTypeFields />
        <button type="submit" className="rounded-md bg-stamp text-cream px-5 py-2.5 text-sm font-medium hover:opacity-90">
          Publish posting
        </button>
      </form>
    </div>
  );
}
