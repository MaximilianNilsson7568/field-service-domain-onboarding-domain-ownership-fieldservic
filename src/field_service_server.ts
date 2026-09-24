import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { InfraiError, infraiFromEnvironment } from "./infrai_client.js";
import {
  onboardFieldServiceCompany,
  onboardingRequest,
} from "./field_service_onboarding.js";

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const infrai = infraiFromEnvironment();

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/onboard") {
    json(response, 404, { error: "route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const parsed = onboardingRequest.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const result = await onboardFieldServiceCompany(parsed, infrai);
    json(response, 201, result);
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      json(response, 400, { error: "invalid request body" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      json(response, status, { error: error.details });
      return;
    }
    console.error(error);
    json(response, 500, { error: "request could not be completed" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`field-service onboarding listening on ${port}`));
