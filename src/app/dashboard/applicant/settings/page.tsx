import { auth } from "@/auth";
import { db } from "@/db";
import { users, erasureRequests } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  getConsentsForUser,
  getEmployersWithActiveApplication,
  grantConsentAction,
  revokeConsentAction,
} from "@/actions/consent";
import { deleteAccountAction, requestErasureAction, updateProfileAction } from "@/actions/account";
import DownloadDataButton from "@/components/DownloadDataButton";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";

const CONSENT_COPY: Record<string, { label: string; description: string }> = {
  FUNCTIONAL_USE: {
    label: "Functional use",
    description: "Core platform functionality — storing your Passport, matching you to occupations, running your applications.",
  },
  AI_PROCESSING: {
    label: "AI Career Coach processing",
    description: "Sending your Passport data to the AI Coach to generate grounded, explainable career recommendations.",
  },
  MARKETING: {
    label: "Marketing communications",
    description: "Occasional emails about new features, programs, or opportunities relevant to you.",
  },
};

function ConsentToggle({
  consentType,
  granted,
  employerId,
  label,
  description,
}: {
  consentType: string;
  granted: boolean;
  employerId?: string;
  label: string;
  description: string;
}) {
  const action = granted ? revokeConsentAction : grantConsentAction;
  return (
    <div className="paper-card rounded-lg p-5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="font-medium text-ink">{label}</p>
        <p className="text-sm text-ink-soft mt-1">{description}</p>
      </div>
      <form action={action.bind(null, consentType, employerId)}>
        <button
          type="submit"
          className={`rounded-md px-4 py-2 text-xs font-medium shrink-0 ${
            granted ? "bg-paper-dim text-ink hover:bg-paper" : "bg-verified text-cream hover:opacity-90"
          }`}
        >
          {granted ? "Revoke" : "Grant"}
        </button>
      </form>
    </div>
  );
}

export default async function ApplicantSettingsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [profile] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const consents = await getConsentsForUser(userId);
  const employersWithApps = await getEmployersWithActiveApplication(userId);
  const myErasureRequests = await db
    .select()
    .from(erasureRequests)
    .where(eq(erasureRequests.userId, userId))
    .orderBy(desc(erasureRequests.requestedAt));
  const pendingErasure = myErasureRequests.find((r) => r.status === "REQUESTED");

  const consentMap = new Map(
    consents.filter((c) => c.employerId === null).map((c) => [c.consentType, c.granted]),
  );
  const employerConsentMap = new Map(
    consents.filter((c) => c.employerId !== null).map((c) => [`${c.consentType}:${c.employerId}`, c.granted]),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Settings</h1>
        <p className="text-ink-soft mt-1 max-w-2xl">
          Control how your data is used, see what employers can see, and manage your account.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-ink">Your profile</h2>
        <form action={updateProfileAction} className="paper-card rounded-lg p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Name</label>
              <input name="name" defaultValue={profile?.name} required minLength={2} maxLength={200}
                className="w-full rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Location</label>
              <input name="location" defaultValue={profile?.location ?? ""} maxLength={200}
                className="w-full rounded-md border border-paper-dim bg-cream px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-mono uppercase tracking-wide text-ink-soft mb-1">Email</label>
            <input value={profile?.email} disabled
              className="w-full rounded-md border border-paper-dim bg-paper-dim px-3 py-2 text-sm text-ink-soft" />
            {/* Email correction isn't self-serve yet in this MVP — see the code comment on
               updateProfileAction in src/actions/account.ts for why, and the final gaps summary. */}
            <p className="text-xs text-ink-soft mt-1">
              Email changes aren&apos;t self-serve yet — contact support if yours needs correcting.
            </p>
          </div>
          <p className="text-xs text-ink-soft">
            Your Skills Passport (skill entries, evidence, verification) is corrected directly on the{" "}
            <a href="/dashboard/applicant/passport" className="underline">Skills Passport</a> page.
          </p>
          <button type="submit" className="rounded-md bg-stamp text-cream px-5 py-2.5 text-sm font-medium hover:opacity-90">
            Save changes
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-ink">Consent</h2>
        <p className="text-ink-soft text-sm max-w-2xl">
          Each consent below is separate and can be withdrawn at any time. Withdrawing Functional Use consent
          will limit what the platform can do for you, since it covers core account features.
        </p>

        {(["FUNCTIONAL_USE", "AI_PROCESSING", "MARKETING"] as const).map((type) => (
          <ConsentToggle
            key={type}
            consentType={type}
            granted={consentMap.get(type) ?? false}
            label={CONSENT_COPY[type].label}
            description={CONSENT_COPY[type].description}
          />
        ))}

        <div className="pt-2">
          <h3 className="font-medium text-ink text-sm mb-2">Employer visibility</h3>
          <p className="text-ink-soft text-sm mb-3">
            Visibility to employers is granted per employer, not globally — you only appear in candidate
            search for employers listed below, and only while any application to them is active.
          </p>
          {employersWithApps.length === 0 ? (
            <p className="text-ink-soft text-sm italic">
              You don&apos;t have any applications yet, so there&apos;s nothing to configure here.
            </p>
          ) : (
            <div className="space-y-3">
              {employersWithApps.map((e) => (
                <ConsentToggle
                  key={e.employerId}
                  consentType="EMPLOYER_VISIBILITY"
                  employerId={e.employerId}
                  granted={employerConsentMap.get(`EMPLOYER_VISIBILITY:${e.employerId}`) ?? false}
                  label={e.employerName}
                  description={`Applied to: ${e.jobTitle}`}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-ink">Your data</h2>
        <div className="paper-card rounded-lg p-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-medium text-ink">Download my data</p>
            <p className="text-sm text-ink-soft mt-1">
              A JSON export of your profile, Skills Passport, applications, and mentor sessions.
            </p>
          </div>
          <DownloadDataButton />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-ink">Account</h2>

        <div className="paper-card rounded-lg p-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-medium text-ink">Delete my account</p>
            <p className="text-sm text-ink-soft mt-1">
              Deactivates your account immediately — you&apos;ll be signed out and won&apos;t be able to log
              back in, and you&apos;ll no longer be discoverable by employers. Your history is retained
              (not erased) to preserve records tied to applications and sessions.
            </p>
          </div>
          <form action={deleteAccountAction}>
            <ConfirmSubmitButton
              confirmMessage="This will deactivate your account and sign you out immediately. Continue?"
              className="rounded-md bg-stamp text-cream px-4 py-2 text-xs font-medium shrink-0 hover:opacity-90"
            >
              Delete my account
            </ConfirmSubmitButton>
          </form>
        </div>

        <div className="paper-card rounded-lg p-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-medium text-ink">Request permanent erasure</p>
            <p className="text-sm text-ink-soft mt-1">
              Separate from deleting your account above — this asks us to permanently and irreversibly
              erase your data. It&apos;s reviewed by an admin rather than actioned instantly, since it has
              to be cascaded correctly across every record that references your account.
            </p>
            {pendingErasure && (
              <p className="text-xs text-verified font-mono mt-2">
                Request pending since {pendingErasure.requestedAt.toISOString().slice(0, 10)}
              </p>
            )}
          </div>
          {!pendingErasure && (
            <form action={requestErasureAction}>
              <ConfirmSubmitButton
                confirmMessage="This asks us to permanently erase your data. It will be reviewed by an admin. Continue?"
                className="rounded-md bg-paper-dim text-ink px-4 py-2 text-xs font-medium shrink-0 hover:bg-paper"
              >
                Request permanent erasure
              </ConfirmSubmitButton>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
