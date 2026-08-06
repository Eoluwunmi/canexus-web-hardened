import Link from "next/link";

const stamps = [
  { level: "VERIFIED", label: "Verified", skill: "Cross-functional team leadership" },
  { level: "EVIDENCE_LINKED", label: "Evidence-linked", skill: "Data analysis (SQL, Excel)" },
  { level: "SELF_REPORTED", label: "Self-reported", skill: "Bilingual communication (EN/FR)" },
];

const stampColor: Record<string, string> = {
  VERIFIED: "text-verified",
  EVIDENCE_LINKED: "text-brass",
  SELF_REPORTED: "text-ink-soft",
};

const steps = [
  {
    n: "01",
    title: "Build your Skills Passport",
    body: "Import your résumé or start fresh. Every skill can carry evidence — a project, a credential, a role — that raises it from self-reported to verified.",
  },
  {
    n: "02",
    title: "Get matched and coached",
    body: "The Transferable Skills Engine ranks real career paths against your evidenced skills, with the gap to close spelled out — and an AI Coach that explains its reasoning, grounded in your actual Passport.",
  },
  {
    n: "03",
    title: "Connect with mentors and employers",
    body: "Book time with mentors who've made your transition before, and apply to employers evaluating you on capability — not keyword-matched résumé text.",
  },
];

export default function LandingPage() {
  return (
    <div className="bg-paper">
      <header className="border-b border-paper-dim">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-display text-xl font-semibold text-ink">CANexus</span>
          <nav className="flex items-center gap-6">
            <Link href="/login" className="text-sm font-medium text-ink-soft hover:text-ink">Log in</Link>
            <Link href="/signup" className="rounded-md bg-ink text-cream px-4 py-2 text-sm font-medium hover:bg-ink-soft transition-colors">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <span className="stamp text-stamp mb-6">Built for Canadian career transitions</span>
          <h1 className="font-display text-5xl leading-[1.05] font-semibold text-ink mt-4">
            Your next career isn&apos;t limited by your last job title.
          </h1>
          <p className="text-lg text-ink-soft mt-6 max-w-xl">
            CANexus is a skills-first career operating system. Build a living, evidence-backed Skills Passport,
            get explainable AI guidance, and connect with mentors and employers hiring on what you can actually do.
          </p>
          <div className="flex items-center gap-4 mt-8">
            <Link href="/signup" className="rounded-md bg-stamp text-cream px-6 py-3 text-sm font-medium hover:opacity-90 transition-opacity">
              Build your Skills Passport
            </Link>
            <Link href="/signup" className="text-sm font-medium text-ink-soft hover:text-ink">
              I&apos;m hiring →
            </Link>
          </div>
        </div>

        <div className="paper-card rounded-xl p-8 -rotate-1">
          <p className="font-mono text-xs uppercase tracking-widest text-ink-soft mb-1">Skills Passport</p>
          <p className="font-display text-2xl text-ink mb-6">Amara O. — Career Twin snapshot</p>
          <div className="space-y-4">
            {stamps.map((s) => (
              <div key={s.skill} className="flex items-center justify-between border-b border-paper-dim pb-4 last:border-0">
                <span className="text-sm text-ink">{s.skill}</span>
                <span className={`stamp ${stampColor[s.level]}`}>{s.label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-ink-soft mt-6 font-mono">
            Top match: Program Coordinator — 78% · explainable, evidence-weighted
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20 border-t border-paper-dim">
        <h2 className="font-display text-3xl font-semibold text-ink mb-12">How it works</h2>
        <div className="grid md:grid-cols-3 gap-10">
          {steps.map((s) => (
            <div key={s.n}>
              <span className="font-mono text-sm text-stamp">{s.n}</span>
              <h3 className="font-display text-xl font-semibold text-ink mt-2">{s.title}</h3>
              <p className="text-sm text-ink-soft mt-3 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20 border-t border-paper-dim">
        <div className="grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="font-display text-3xl font-semibold text-ink">Skills over resumes. Evidence over claims.</h2>
            <p className="text-ink-soft mt-4 leading-relaxed">
              A job title tells you where someone has been. A Skills Passport tells you what they can do next —
              and every claim in it is explainable, down to the exact evidence that backs it.
            </p>
          </div>
          <ul className="space-y-4 font-mono text-sm text-ink-soft">
            <li className="flex gap-3"><span className="text-stamp">→</span> Explainable AI on every recommendation</li>
            <li className="flex gap-3"><span className="text-stamp">→</span> Mentorship built into the transition, not bolted on</li>
            <li className="flex gap-3"><span className="text-stamp">→</span> A lifelong professional identity you own</li>
            <li className="flex gap-3"><span className="text-stamp">→</span> Designed and hosted for the Canadian labour market</li>
          </ul>
        </div>
      </section>

      <section className="border-t border-paper-dim">
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <h2 className="font-display text-3xl font-semibold text-ink">Start your Skills Passport today</h2>
          <p className="text-ink-soft mt-3">Free for applicants. Always.</p>
          <Link href="/signup" className="inline-block mt-8 rounded-md bg-stamp text-cream px-8 py-3 text-sm font-medium hover:opacity-90 transition-opacity">
            Get started
          </Link>
        </div>
      </section>

      <footer className="border-t border-paper-dim">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between text-xs text-ink-soft">
          <span>© {new Date().getFullYear()} CANexus</span>
          <span className="font-mono">A Skills-First Career Operating System for Canada</span>
        </div>
      </footer>
    </div>
  );
}
