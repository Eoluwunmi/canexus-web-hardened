import { getApplicantFundingIncentives } from "@/actions/funding";
import FundingIncentiveBrowser from "@/components/FundingIncentiveBrowser";

export default async function ApplicantFundingPage({ searchParams }: { searchParams: Promise<{ jurisdiction?: string; type?: string }> }) {
  const { jurisdiction, type } = await searchParams;
  const incentives = await getApplicantFundingIncentives({});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Funding & Incentives</h1>
        <p className="text-ink-soft mt-1 max-w-2xl">
          Grants, scholarships, and bursaries that can support your transition — curated and kept current
          by the CANexus team.
        </p>
      </div>
      <FundingIncentiveBrowser incentives={incentives} basePath="/dashboard/applicant/funding" jurisdiction={jurisdiction} incentiveType={type} />
    </div>
  );
}
