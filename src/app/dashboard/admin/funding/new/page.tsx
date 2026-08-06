import { redirect } from "next/navigation";
import { createFundingIncentiveAction } from "@/actions/funding";
import FundingIncentiveForm from "@/components/FundingIncentiveForm";

export default function NewFundingIncentivePage() {
  async function action(formData: FormData) {
    "use server";
    await createFundingIncentiveAction(formData);
    redirect("/dashboard/admin/funding");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">New funding incentive</h1>
      </div>
      <FundingIncentiveForm action={action} submitLabel="Create incentive" />
    </div>
  );
}
