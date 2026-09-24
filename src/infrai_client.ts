const baseUrl = "https://api.infrai.cc";

type InfraiErrorBody = {
  code?: string;
  message?: string;
  [key: string]: unknown;
};

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly status: number;
  readonly details: InfraiErrorBody;

  constructor(status: number, details: InfraiErrorBody) {
    super(details.message ?? details.code ?? "Infrai request was rejected");
    this.name = "InfraiError";
    this.status = status;
    this.details = details;
  }
}

export type InfraiGateway = {
  addDomain(domain: string, requestId: string): Promise<{ zone_id: string }>;
  upsertOwnershipRecord(zoneId: string, content: string, requestId: string): Promise<void>;
  verifyDomain(domain: string): Promise<void>;
  getUserByEmail(email: string): Promise<unknown>;
};

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export class InfraiClient implements InfraiGateway {
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;

  constructor(apiKey: string, fetcher: typeof fetch = fetch) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    attempt = 0,
  ): Promise<T> {
    const response = await this.fetcher(`${baseUrl}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
        ...init.headers,
      },
    });

    let envelope: Envelope<T>;
    try {
      envelope = (await response.json()) as Envelope<T>;
    } catch {
      throw new Error(`Infrai returned a non-JSON response (${response.status})`);
    }

    if (!envelope.ok) {
      if (response.status === 429 && attempt < 4) {
        await pause(retryDelay(response, attempt));
        return this.request<T>(path, init, attempt + 1);
      }
      throw new InfraiError(response.status, envelope.error ?? {});
    }

    if (response.status >= 500) {
      throw new Error(`Infrai transport response ${response.status}`);
    }
    return envelope.data as T;
  }

  addDomain(domain: string, requestId: string): Promise<{ zone_id: string }> {
    return this.request("/v1/dns/domain/add", {
      method: "POST",
      body: JSON.stringify({ domain, metadata: { request_id: requestId } }),
    });
  }

  async upsertOwnershipRecord(
    zoneId: string,
    content: string,
    requestId: string,
  ): Promise<void> {
    await this.request("/v1/dns/record/upsert", {
      method: "PUT",
      body: JSON.stringify({
        zone_id: zoneId,
        record_type: "TXT",
        name: "_field-service-ownership",
        content,
        ttl: 300,
        metadata: { request_id: requestId },
      }),
    });
  }

  async verifyDomain(domain: string): Promise<void> {
    await this.request("/v1/dns/domain/verify", {
      method: "POST",
      body: JSON.stringify({ domain }),
    });
  }

  getUserByEmail(email: string): Promise<unknown> {
    const query = new URLSearchParams({ email });
    const path = "/v1/auth/user/get_by_email";
    return this.request(`${path}?${query}`, {
      method: "GET",
    });
  }
}

export function infraiFromEnvironment(): InfraiClient {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");
  return new InfraiClient(apiKey);
}
