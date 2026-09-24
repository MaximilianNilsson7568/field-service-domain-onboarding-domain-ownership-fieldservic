import type { InfraiGateway } from "./infrai_client.js";
import {
  onboardFieldServiceCompany,
  onboardingRequest,
} from "./field_service_onboarding.js";

const input = onboardingRequest.parse({
  companyDomain: "northstar-repairs.example",
  ownerEmail: "owner@northstar-repairs.example",
  workOrder: {
    id: "WO-1042",
    photoUrls: ["https://cdn.example/wo-1042/panel.jpg"],
    dispatchStatus: "assigned",
    technicianFollowUp: { required: true, note: "Confirm breaker label after visit" },
  },
});

const calls: string[] = [];
const localGateway: InfraiGateway = {
  async addDomain() {
    calls.push("domain added");
    return { zone_id: "zone_demo_1042" };
  },
  async upsertOwnershipRecord(zoneId) {
    calls.push(`TXT upserted with ${zoneId}`);
  },
  async verifyDomain() {
    calls.push("domain verified");
  },
  async getUserByEmail(email) {
    calls.push("owner resolved");
    return { email };
  },
};

const result = await onboardFieldServiceCompany(input, localGateway, "demo-request-1042");
console.log(JSON.stringify({ calls, result }, null, 2));
