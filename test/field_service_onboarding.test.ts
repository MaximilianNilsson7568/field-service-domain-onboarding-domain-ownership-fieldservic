import assert from "node:assert/strict";
import test from "node:test";
import type { InfraiGateway } from "../src/infrai_client.js";
import {
  onboardFieldServiceCompany,
  onboardingRequest,
} from "../src/field_service_onboarding.js";

test("onboarding completes only after TXT verification and owner lookup", async () => {
  const calls: string[] = [];
  const gateway: InfraiGateway = {
    async addDomain(domain) {
      calls.push(`add:${domain}`);
      return { zone_id: "zone_42" };
    },
    async upsertOwnershipRecord(zoneId) {
      calls.push(`record:${zoneId}`);
    },
    async verifyDomain(domain) {
      calls.push(`verify:${domain}`);
    },
    async getUserByEmail(email) {
      calls.push(`user:${email}`);
      return { id: "user_42", email };
    },
  };

  const input = onboardingRequest.parse({
    companyDomain: "bright-fix.example",
    ownerEmail: "owner@bright-fix.example",
    workOrder: {
      id: "WO-42",
      photoUrls: ["https://cdn.example/wo-42/arrival.jpg"],
      dispatchStatus: "en_route",
      technicianFollowUp: { required: false },
    },
  });

  const result = await onboardFieldServiceCompany(input, gateway, "request-42");

  assert.equal(result.onboardingStatus, "complete");
  assert.equal(result.zoneId, "zone_42");
  assert.deepEqual(calls, [
    "add:bright-fix.example",
    "record:zone_42",
    "verify:bright-fix.example",
    "user:owner@bright-fix.example",
  ]);
});

test("request boundary rejects an owner outside the company domain", () => {
  const result = onboardingRequest.safeParse({
    companyDomain: "bright-fix.example",
    ownerEmail: "owner@other.example",
    workOrder: {
      id: "WO-43",
      photoUrls: ["https://cdn.example/wo-43/arrival.jpg"],
      dispatchStatus: "queued",
      technicianFollowUp: { required: false },
    },
  });

  assert.equal(result.success, false);
});
