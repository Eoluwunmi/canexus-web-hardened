import { redirect, notFound } from "next/navigation";
import { getFundingIncentiveById, updateFundingIncentiveAction } from "@/actions/funding";
import FundingIncentiveForm from "@/components/FundingIncentiveForm";

export default async function EditFundingIncentivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const incentive = await getFundingIncentiveById(id);
  if (!incentive) notFound();

  async function action(formData: FormData) {
    "use server";
    await updateFundingIncentiveAction(id, formData);
    redirect("/dashboard/admin/funding");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Edit funding incentive</h1>
      </div>
      <FundingIncentiveForm action={action} initial={incentive} submitLabel="Save changes" />
    </div>
  );
}
