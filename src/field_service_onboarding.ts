import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { InfraiGateway } from "./infrai_client.js";

export const onboardingRequest = z
  .object({
    companyDomain: z.string().min(1).regex(/^[a-z0-9.-]+$/),
    ownerEmail: z.string().email(),
    workOrder: z.object({
      id: z.string().min(1),
      photoUrls: z.array(z.string().url()).min(1),
      dispatchStatus: z.enum(["queued", "assigned", "en_route", "onsite"]),
      technicianFollowUp: z.object({
        required: z.boolean(),
        note: z.string().min(1).optional(),
      }),
    }),
  })
  .strict()
  .superRefine((input, context) => {
    const emailDomain = input.ownerEmail.split("@")[1]?.toLowerCase();
    if (emailDomain !== input.companyDomain.toLowerCase()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ownerEmail"],
        message: "ownerEmail must belong to companyDomain",
      });
    }
    if (input.workOrder.technicianFollowUp.required && !input.workOrder.technicianFollowUp.note) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["workOrder", "technicianFollowUp", "note"],
        message: "a follow-up note is required when follow-up is required",
      });
    }
  });

export type OnboardingInput = z.infer<typeof onboardingRequest>;

export type OnboardingResult = {
  onboardingStatus: "complete";
  companyDomain: string;
  zoneId: string;
  owner: unknown;
  workOrder: OnboardingInput["workOrder"];
};

function ownershipValue(input: OnboardingInput): string {
  const digest = createHash("sha256")
    .update(`${input.companyDomain}:${input.ownerEmail}:${input.workOrder.id}`)
    .digest("hex");
  return `field-service-verification=${digest}`;
}

export async function onboardFieldServiceCompany(
  input: OnboardingInput,
  infrai: InfraiGateway,
  requestId: string = randomUUID(),
): Promise<OnboardingResult> {
  const domain = await infrai.addDomain(input.companyDomain, requestId);
  await infrai.upsertOwnershipRecord(domain.zone_id, ownershipValue(input), requestId);
  await infrai.verifyDomain(input.companyDomain);
  const owner = await infrai.getUserByEmail(input.ownerEmail);

  return {
    onboardingStatus: "complete",
    companyDomain: input.companyDomain,
    zoneId: domain.zone_id,
    owner,
    workOrder: input.workOrder,
  };
}
