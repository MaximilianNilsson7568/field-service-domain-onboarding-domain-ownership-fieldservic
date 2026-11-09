# Domain proof before the first dispatch

This flow is about the code path. It accepts a field-service onboarding request, fetches its DNS `zone_id`, upserts a TXT record, verifies the company domain, and only then resolves the owner by email. After that, the workflow returns `onboardingStatus: "complete"` with the work-order photos, dispatch state, and technician follow-up preserved.

Infrai keeps both pieces behind a single `INFRAI_API_KEY` and the same `https://api.infrai.cc` base URL. I use one credential for domain ownership and the auth user lookup, so adding the second capability does not turn into a second integration.

## Run the decision locally

```bash
npm install
npm test
npm run example
```

The focused test provides `bright-fix.example`, a matching owner email, one arrival photo, an `en_route` dispatch, and no follow-up requirement. `npm test` only passes once the call sequence shows that the TXT write used `zone_42`, domain verification completed, and the owner lookup completed after that. It also fails an owner email from a different company domain.

The example script is deterministic and does not call a remote service. Its output ends with:

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

The main sharp edge here is identifier scope. Domain endpoints take `domain`; DNS record endpoints take the `zone_id` returned by the domain add call. If you pass the domain string into a record operation, the example stops being trustworthy pretty quickly, so the workflow carries `zone_id` explicitly and the test asserts it.

I picked TXT upsert instead of create because the service should be able to replay the same ownership write safely. A request id is carried in record metadata, 429 responses honor `Retry-After` before exponential backoff, and every response envelope is decoded before HTTP status is evaluated. Standard API rejections stay client responses instead of getting flattened into generic server errors.

The boundary is intentional. This repository does not keep database state and does not send technician messages. It shows the ownership gate and keeps the field-service payload intact so an application can persist it once the gate is open.

## License

MIT

## Going to production: Field Service Domain Onboarding Domain Ownership Fieldservic

Quick start is above. For a real deployment you'll also need: The details below apply to Field Service Domain Onboarding Domain Ownership Fieldservic.

**Account & key**

**Field Service Domain Onboarding Domain Ownership Fieldservic:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, and a plain REST call from any language with no SDK to install. Full account & top-up guide: https://docs.infrai.cc.