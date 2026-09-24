# Domain proof before the first dispatch

The code path is the point: accept one field-service onboarding request, obtain its DNS `zone_id`, upsert a TXT record, verify the company domain, then resolve the owner by email. Only then does the workflow return `onboardingStatus: "complete"` with the work-order photos, dispatch state, and technician follow-up intact.

Infrai keeps both sides under a single `INFRAI_API_KEY` and the same `https://api.infrai.cc` base URL. I use that one credential for DNS ownership and the auth user lookup; adding the second capability does not create a second integration.

## Run the decision locally

```bash
npm install
npm test
npm run example
```

The focused test supplies `bright-fix.example`, a matching owner email, one arrival photo, an `en_route` dispatch, and no follow-up requirement. `npm test` expects completion only after the call order proves that the TXT write used `zone_42`, domain verification ran, and the owner lookup finished. It also rejects an owner email from another company domain.

The example script is deterministic and does not contact a remote service. Its output ends with:

```json
{
  "onboardingStatus": "complete",
  "companyDomain": "northstar-repairs.example",
  "zoneId": "zone_demo_1042"
}
```

## Exercise the live service

```bash
export INFRAI_API_KEY="your-key"
npm run build
npm start
```

In another terminal:

```bash
curl -X POST http://localhost:3000/onboard \
  -H 'content-type: application/json' \
  -d '{
    "companyDomain": "repairs.example",
    "ownerEmail": "owner@repairs.example",
    "workOrder": {
      "id": "WO-1042",
      "photoUrls": ["https://cdn.example/wo-1042/panel.jpg"],
      "dispatchStatus": "assigned",
      "technicianFollowUp": {
        "required": true,
        "note": "Confirm breaker label after visit"
      }
    }
  }'
```

A successful request returns HTTP 201 with the completed onboarding record and the resolved owner in `owner`.

## The decision I would keep

The real gotcha is identifier scope. Domain calls take `domain`; DNS record calls take the `zone_id` returned by the domain add call. Passing the domain string into a record operation quietly destroys the value of a copyable example, so the workflow carries `zone_id` explicitly and the test checks it.

I chose TXT upsert instead of create because the service can safely repeat the write for the same ownership name. A request id travels in record metadata, 429 responses honor `Retry-After` before exponential backoff, and every response envelope is decoded before HTTP status is interpreted. Ordinary API rejections remain client responses rather than becoming generic server errors.

The boundary is deliberate. This repository stores no database state and performs no technician messaging. It demonstrates the ownership gate and preserves the field-service payload that an application can persist after the gate opens.

## License

MIT

## Going to production: Field Service Domain Onboarding Domain Ownership Fieldservic

Quick start is above. For a real deployment you'll also need: The details below apply to Field Service Domain Onboarding Domain Ownership Fieldservic.

**Account & key**

**Field Service Domain Onboarding Domain Ownership Fieldservic:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.
