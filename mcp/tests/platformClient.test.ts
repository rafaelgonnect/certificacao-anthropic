import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PlatformClient } from "../src/platformClient.js";

const BASE = "http://lms.test";

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const status = init.status ?? (init.ok === false ? 400 : 200);
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("PlatformClient", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("login stores the token and later calls send Authorization: Bearer <token>", async () => {
    const client = new PlatformClient({ baseUrl: BASE });

    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ token: "tok-123", user: { name: "Rafa", role: "student" } }),
    );

    const user = await client.login("rafa@test.com", "secret");
    expect(user).toEqual({ name: "Rafa", role: "student" });

    // Login request: no auth header, correct method/body/url.
    const [loginUrl, loginInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(loginUrl).toBe(`${BASE}/api/auth/login`);
    expect(loginInit.method).toBe("POST");
    expect(JSON.parse(loginInit.body as string)).toEqual({
      email: "rafa@test.com",
      password: "secret",
    });
    const loginHeaders = loginInit.headers as Record<string, string>;
    expect(loginHeaders.Authorization).toBeUndefined();

    // A subsequent call must include the stored token.
    fetchSpy.mockResolvedValueOnce(jsonResponse([]));
    await client.listCertifications();

    const [, listInit] = fetchSpy.mock.calls[1] as [string, RequestInit];
    const listHeaders = listInit.headers as Record<string, string>;
    expect(listHeaders.Authorization).toBe("Bearer tok-123");
  });

  it("getTrilha returns the parsed JSON body", async () => {
    const client = new PlatformClient({ baseUrl: BASE, token: "t" });
    const trilha = {
      title: "CCA Foundations",
      modules: [{ title: "M1", lessons: [{ id: "l1", title: "Intro" }] }],
    };
    fetchSpy.mockResolvedValueOnce(jsonResponse(trilha));

    const result = await client.getTrilha("cca-foundations");
    expect(result).toEqual(trilha);

    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/certifications/cca-foundations`);
  });

  it("throws an Error containing the body's error message on non-OK responses", async () => {
    const client = new PlatformClient({ baseUrl: BASE, token: "t" });
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ error: "lesson not found" }, { status: 404 }),
    );

    await expect(client.getLesson("missing")).rejects.toThrow("lesson not found");
    await expect(
      client.getLesson("missing").catch((e: Error) => e.message),
    ).resolves.not.toBeUndefined();
  });

  it("gradeFlashcard sends POST with the grade in the body to the right path", async () => {
    const client = new PlatformClient({ baseUrl: BASE, token: "tok" });
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ dueAt: "2026-06-20T00:00:00Z", intervalDays: 4 }),
    );

    const res = await client.gradeFlashcard("fc-9", "good");
    expect(res).toEqual({ dueAt: "2026-06-20T00:00:00Z", intervalDays: 4 });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/reviews/fc-9/grade`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ grade: "good" });
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("answerQuestion and quiz helpers build query strings and bodies correctly", async () => {
    const client = new PlatformClient({ baseUrl: BASE, token: "tok" });

    fetchSpy.mockResolvedValueOnce(jsonResponse([{ id: "q1", prompt: "?", options: [] }]));
    await client.getQuiz("cca-foundations", 5);
    const [quizUrl] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(quizUrl).toBe(`${BASE}/api/quiz?cert=cca-foundations&n=5`);

    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ correct: true, correctIndex: 2, explanation: "yep" }),
    );
    await client.answerQuestion("q1", 2);
    const [ansUrl, ansInit] = fetchSpy.mock.calls[1] as [string, RequestInit];
    expect(ansUrl).toBe(`${BASE}/api/quiz/answer`);
    expect(JSON.parse(ansInit.body as string)).toEqual({
      questionId: "q1",
      chosenIndex: 2,
    });
  });
});
