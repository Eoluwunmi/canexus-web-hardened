import "dotenv/config";
import { db } from "./index";
import { skills, occupations, occupationSkills, users, employers, jobs, jobSkills, mentorProfiles, userSkills, evidenceFiles, fundingIncentives } from "./schema";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { buildEvidenceStorageKey } from "@/lib/storage";

async function main() {
  console.log("Seeding CANexus demo data...");

  const skillNames: [string, string][] = [
    ["Project management", "Operations"],
    ["Stakeholder communication", "Communication"],
    ["Data analysis (SQL, Excel)", "Data"],
    ["Cross-functional team leadership", "Leadership"],
    ["Customer service", "Operations"],
    ["Budgeting & forecasting", "Finance"],
    ["Curriculum design", "Education"],
    ["Conflict resolution", "Communication"],
    ["Scheduling & logistics", "Operations"],
    ["Bilingual communication (EN/FR)", "Communication"],
    ["Process improvement", "Operations"],
    ["Public speaking", "Communication"],
    ["Basic bookkeeping", "Finance"],
    ["Volunteer coordination", "Leadership"],
    ["Report writing", "Communication"],
  ];
  const skillRows = await db.insert(skills).values(skillNames.map(([name, category]) => ({ name, category }))).returning();
  const skillId = (name: string) => skillRows.find((s) => s.name === name)!.id;

  const occTitles: { title: string; nocCode: string; skills: [string, number][] }[] = [
    {
      title: "Program Coordinator",
      nocCode: "12200",
      skills: [
        ["Project management", 5],
        ["Stakeholder communication", 4],
        ["Scheduling & logistics", 4],
        ["Report writing", 3],
        ["Budgeting & forecasting", 3],
      ],
    },
    {
      title: "Operations Manager",
      nocCode: "10019",
      skills: [
        ["Cross-functional team leadership", 5],
        ["Process improvement", 5],
        ["Budgeting & forecasting", 4],
        ["Project management", 4],
        ["Conflict resolution", 3],
      ],
    },
    {
      title: "Client Success Specialist",
      nocCode: "64100",
      skills: [
        ["Customer service", 5],
        ["Stakeholder communication", 4],
        ["Conflict resolution", 4],
        ["Bilingual communication (EN/FR)", 3],
        ["Report writing", 2],
      ],
    },
    {
      title: "Training & Development Coordinator",
      nocCode: "41401",
      skills: [
        ["Curriculum design", 5],
        ["Public speaking", 4],
        ["Stakeholder communication", 3],
        ["Volunteer coordination", 3],
        ["Report writing", 3],
      ],
    },
    {
      title: "Data & Reporting Analyst",
      nocCode: "12011",
      skills: [
        ["Data analysis (SQL, Excel)", 5],
        ["Report writing", 4],
        ["Process improvement", 3],
        ["Budgeting & forecasting", 2],
      ],
    },
  ];

  for (const occ of occTitles) {
    const [row] = await db.insert(occupations).values({ title: occ.title, nocCode: occ.nocCode, demandIndex: 0.6 }).returning();
    await db.insert(occupationSkills).values(occ.skills.map(([name, importance]) => ({ occupationId: row.id, skillId: skillId(name), importance })));
  }

  const password = await bcrypt.hash("Password123!", 10);

  const [applicant] = await db
    .insert(users)
    .values({ name: "Amara Okafor", email: "applicant@demo.canexus.ca", passwordHash: password, role: "APPLICANT", location: "Calgary, AB" })
    .returning();

  await db.insert(userSkills).values([
    { userId: applicant.id, skillId: skillId("Stakeholder communication"), verificationLevel: "EVIDENCE_LINKED", evidence: "Led weekly stakeholder updates across 3 departments for 2 years as a volunteer coordinator.", visibility: "EMPLOYERS" },
    { userId: applicant.id, skillId: skillId("Scheduling & logistics"), verificationLevel: "SELF_REPORTED", visibility: "EMPLOYERS" },
    { userId: applicant.id, skillId: skillId("Customer service"), verificationLevel: "VERIFIED", evidence: "5 years front-line retail management, verified via employer reference.", visibility: "EMPLOYERS" },
    { userId: applicant.id, skillId: skillId("Bilingual communication (EN/FR)"), verificationLevel: "SELF_REPORTED", visibility: "EMPLOYERS" },
  ]);
  const [stakeholderSkillRow] = await db
    .select()
    .from(userSkills)
    .where(and(eq(userSkills.userId, applicant.id), eq(userSkills.skillId, skillId("Stakeholder communication"))))
    .limit(1);

  // Evidence file: only seeded if S3 is actually configured (S3_BUCKET set), and only by
  // really uploading a tiny real object first — a DB row pointing at a storage key with no
  // backing object would make the "View" button in the UI fail in a confusing way. If S3
  // isn't configured, this is skipped with a clear note rather than faked.
  if (process.env.S3_BUCKET) {
    try {
      const storageKey = buildEvidenceStorageKey(applicant.id, stakeholderSkillRow.id, "volunteer-coordinator-reference-letter.png");
      const tinyPng = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      );
      const s3 = new S3Client({
        region: process.env.S3_REGION || "ca-central-1",
        endpoint: process.env.S3_ENDPOINT || undefined,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
        credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
      });
      await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: storageKey, Body: tinyPng, ContentType: "image/png" }));
      await db.insert(evidenceFiles).values({
        userSkillId: stakeholderSkillRow.id,
        fileName: "volunteer-coordinator-reference-letter.png",
        storageKey,
        mimeType: "image/png",
        sizeBytes: tinyPng.length,
      });
      console.log("Seeded 1 evidence file (real object uploaded to S3_BUCKET).");
    } catch (err) {
      console.warn("S3_BUCKET is set, but seeding an evidence file failed — skipping. Error:", err instanceof Error ? err.message : err);
    }
  } else {
    console.log("S3_BUCKET not set — skipping evidence file seed data (the row would point at a non-existent object).");
  }

  const [employerUser] = await db
    .insert(users)
    .values({ name: "Priya Nair", email: "employer@demo.canexus.ca", passwordHash: password, role: "EMPLOYER", location: "Toronto, ON" })
    .returning();
  const [employer] = await db.insert(employers).values({ ownerUserId: employerUser.id, orgName: "Northline Community Services", industry: "Nonprofit", sizeBand: "50-200" }).returning();

  const [job] = await db
    .insert(jobs)
    .values({
      employerId: employer.id,
      title: "Program Coordinator, Newcomer Services",
      description: "Coordinate intake, scheduling, and reporting for our newcomer settlement program across three sites.",
      location: "Toronto, ON (hybrid)",
      status: "OPEN",
    })
    .returning();
  await db.insert(jobSkills).values([
    { jobId: job.id, skillId: skillId("Stakeholder communication"), requirementType: "REQUIRED" },
    { jobId: job.id, skillId: skillId("Scheduling & logistics"), requirementType: "REQUIRED" },
    { jobId: job.id, skillId: skillId("Bilingual communication (EN/FR)"), requirementType: "PREFERRED" },
    { jobId: job.id, skillId: skillId("Report writing"), requirementType: "PREFERRED" },
  ]);

  // A second posting demonstrating the work-integrated-learning opportunity types (Feature 2).
  const [microInternship] = await db
    .insert(jobs)
    .values({
      employerId: employer.id,
      title: "Data & Reporting Micro-Internship",
      description: "A short, low-barrier project: build a quarterly reporting dashboard for our newcomer settlement program using data we provide. Great for a first foray into the nonprofit sector.",
      location: "Toronto, ON (remote)",
      status: "OPEN",
      opportunityType: "MICRO_INTERNSHIP",
      durationWeeks: 4,
      isCreditEligible: false,
      estimatedHoursPerWeek: 10,
      applicationDeadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 21), // 3 weeks out
      isPaid: true,
    })
    .returning();
  await db.insert(jobSkills).values([
    { jobId: microInternship.id, skillId: skillId("Data analysis (SQL, Excel)"), requirementType: "REQUIRED" },
    { jobId: microInternship.id, skillId: skillId("Report writing"), requirementType: "PREFERRED" },
  ]);

  const [coop] = await db
    .insert(jobs)
    .values({
      employerId: employer.id,
      title: "Operations Co-op (Fall Term)",
      description: "One-term co-op supporting program operations: scheduling, vendor coordination, and process documentation. Open to current post-secondary students.",
      location: "Toronto, ON (hybrid)",
      status: "OPEN",
      opportunityType: "CO_OP",
      durationWeeks: 16,
      isCreditEligible: true,
      estimatedHoursPerWeek: 35,
      applicationDeadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 45),
      isPaid: true,
    })
    .returning();
  await db.insert(jobSkills).values([
    { jobId: coop.id, skillId: skillId("Scheduling & logistics"), requirementType: "REQUIRED" },
    { jobId: coop.id, skillId: skillId("Process improvement"), requirementType: "PREFERRED" },
  ]);

  const [mentorUser] = await db
    .insert(users)
    .values({ name: "Devon Marchetti", email: "mentor@demo.canexus.ca", passwordHash: password, role: "MENTOR", location: "Vancouver, BC" })
    .returning();
  await db.insert(mentorProfiles).values({
    userId: mentorUser.id,
    bio: "15 years in nonprofit operations and program management. I made the jump from retail management to the nonprofit sector myself in 2016.",
    expertiseTags: "Nonprofit careers, Operations, Career changers",
    status: "ACTIVE",
  });

  // No ADMIN demo account existed before this — added so the admin dashboard (audit log,
  // skill verification queue) is actually reachable via the seeded demo data, not just via a
  // hand-crafted DB row.
  await db.insert(users).values({ name: "CANexus Admin", email: "admin@demo.canexus.ca", passwordHash: password, role: "ADMIN" });

  await db.insert(fundingIncentives).values([
    {
      title: "Canada Summer Jobs",
      description: "Wage subsidy helping employers create summer job placements for youth aged 15-30.",
      incentiveType: "WAGE_SUBSIDY",
      audience: "EMPLOYER",
      jurisdiction: "Federal",
      amountDescription: "Up to 50% of provincial/territorial minimum hourly wage",
      eligibilitySummary: "Not-for-profit and public-sector employers; private sector employers with 50 or fewer employees.",
      sourceUrl: "https://www.canada.ca/en/employment-social-development/services/funding/canada-summer-jobs.html",
      applicationDeadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      isActive: true,
    },
    {
      title: "Canada Training Credit",
      description: "Refundable tax credit to help cover the cost of eligible training fees.",
      incentiveType: "TAX_CREDIT",
      audience: "APPLICANT",
      jurisdiction: "Federal",
      amountDescription: "$250/year, accumulates to a $5,000 lifetime limit",
      eligibilitySummary: "Canadians aged 26-65 with at least $10,000 in working income the prior year.",
      sourceUrl: "https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/canada-training-credit.html",
      applicationDeadline: null,
      isActive: true,
    },
    {
      title: "Alberta Jobs Now",
      description: "Wage and training subsidy to help Alberta employers hire and train new employees.",
      incentiveType: "WAGE_SUBSIDY",
      audience: "EMPLOYER",
      jurisdiction: "Alberta",
      amountDescription: "25-37.5% of wages for up to 52 weeks",
      eligibilitySummary: "Alberta-based employers hiring unemployed or underemployed Albertans into new or vacant positions.",
      sourceUrl: "https://www.alberta.ca/jobs-now-program",
      applicationDeadline: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10), // intentionally past-deadline demo data
      isActive: true,
    },
    {
      title: "Newcomer Career Bridging Bursary",
      description: "Bursary supporting internationally trained professionals completing Canadian credential-bridging programs.",
      incentiveType: "BURSARY",
      audience: "APPLICANT",
      jurisdiction: "Ontario",
      amountDescription: "Up to $3,000, one-time",
      eligibilitySummary: "Permanent residents or protected persons enrolled in a recognized bridge training program in Ontario.",
      sourceUrl: "https://www.ontario.ca/page/bridge-training-programs",
      applicationDeadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60),
      isActive: true,
    },
    {
      title: "Student Work Placement Program",
      description: "Wage subsidy for employers offering student work-integrated learning placements (co-ops, internships).",
      incentiveType: "WAGE_SUBSIDY",
      audience: "BOTH",
      jurisdiction: "Federal",
      amountDescription: "Up to 70% of wages, to a maximum of $7,000-$10,000 per placement",
      eligibilitySummary: "Post-secondary students in a WIL placement; small and medium-sized employers.",
      sourceUrl: "https://www.canada.ca/en/employment-social-development/programs/student-work-placement.html",
      applicationDeadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90),
      isActive: true,
    },
    {
      title: "Retired Pilot Program (discontinued example)",
      description: "Example of a deactivated incentive — demonstrates the admin deactivate flow rather than a hard delete.",
      incentiveType: "GRANT",
      audience: "BOTH",
      jurisdiction: "Federal",
      amountDescription: "N/A",
      eligibilitySummary: "N/A — retained for audit history only.",
      sourceUrl: "https://www.canada.ca/en.html",
      applicationDeadline: null,
      isActive: false,
    },
  ]);

  console.log("Seed complete.");
  console.log("Demo logins (password: Password123!):");
  console.log("  Applicant: applicant@demo.canexus.ca");
  console.log("  Employer:  employer@demo.canexus.ca");
  console.log("  Mentor:    mentor@demo.canexus.ca");
  console.log("  Admin:     admin@demo.canexus.ca");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
