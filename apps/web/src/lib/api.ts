const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export interface GenerationInput {
  business_idea: string;
  industry: string;
  target_market: string;
  revenue_model?: string;
  geography?: string;
  is_preview: boolean;
}

export interface GenerateResponse {
  job_id: string;
  is_preview: boolean;
  stream_url: string;
  usage: {
    allowed: boolean;
    tier: string;
    plans_used: number;
    plans_limit: number;
    is_preview: boolean;
    message?: string;
  };
}

export interface JobResponse {
  job_id: string;
  status: "reserved" | "running" | "completed" | "failed" | "canceled";
  stage: string | null;
  is_preview: boolean;
  plan?: {
    plan_id: string;
    title: string;
    content: { sections: Record<string, string> };
    is_preview: boolean;
  };
}

export async function startGeneration(
  input: GenerationInput,
  token: string,
): Promise<GenerateResponse> {
  const res = await fetch(`${API_URL}/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new APIError(res.status, err.error ?? "Generation failed");
  }
  return res.json();
}

export async function pollJob(jobId: string, token: string): Promise<JobResponse> {
  const res = await fetch(`${API_URL}/jobs/${jobId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new APIError(res.status, err.error ?? "Job poll failed");
  }
  return res.json();
}

/** Poll until terminal status, calling onProgress on each tick. */
export async function waitForJob(
  jobId: string,
  token: string,
  onProgress: (job: JobResponse) => void,
  intervalMs = 2000,
  timeoutMs = 300_000,
): Promise<JobResponse> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = await pollJob(jobId, token);
    onProgress(job);
    if (job.status === "completed" || job.status === "failed") return job;
    await sleep(intervalMs);
  }
  throw new Error("Generation timed out");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "APIError";
  }
}
