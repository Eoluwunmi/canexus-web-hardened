import { getEmployerFundingIncentives } from "@/actions/funding";
import FundingIncentiveBrowser from "@/components/FundingIncentiveBrowser";

export default async function EmployerFundingPage({ searchParams }: { searchParams: Promise<{ jurisdiction?: string; type?: string }> }) {
  const { jurisdiction, type } = await searchParams;
  const incentives = await getEmployerFundingIncentives({});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Funding & Incentives</h1>
        <p className="text-ink-soft mt-1 max-w-2xl">
          Wage subsidies, tax credits, and grants that can offset the cost of hiring — curated and kept
          current by the CANexus team.
        </p>
      </div>
      <FundingIncentiveBrowser incentives={incentives} basePath="/dashboard/employer/funding" jurisdiction={jurisdiction} incentiveType={type} />
    </div>
  );
}
