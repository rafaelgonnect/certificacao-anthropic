/**
 * Typed client over `fetch` for the Certificacao LMS REST API.
 *
 * Dependency-free (only the global `fetch`). Each method maps to one REST
 * endpoint, sends `Authorization: Bearer <token>` when a token is set, and
 * throws a clear Error (including HTTP status + the response body's `error`
 * field) on any non-OK response.
 */

export type Grade = "again" | "hard" | "good" | "easy";

export interface User {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  [key: string]: unknown;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface Certification {
  slug: string;
  title: string;
  [key: string]: unknown;
}

export interface Lesson {
  id: string;
  title: string;
  readingMd?: string;
  [key: string]: unknown;
}

export interface ModuleWithLessons {
  title: string;
  lessons: Array<{ id: string; title: string }>;
}

export interface Trilha {
  title: string;
  modules: ModuleWithLessons[];
  [key: string]: unknown;
}

export interface DueReview {
  id: string;
  front: string;
  back: string;
  [key: string]: unknown;
}

export interface GradeResult {
  dueAt: string;
  intervalDays: number;
  [key: string]: unknown;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  [key: string]: unknown;
}

export interface AnswerResult {
  correct: boolean;
  correctIndex: number;
  explanation: string;
  [key: string]: unknown;
}

export type MasteryMap = Record<string, { mastery: number; attempts: number }>;

export interface PlatformClientOptions {
  baseUrl: string;
  token?: string;
}

export class PlatformClient {
  private readonly baseUrl: string;
  private token?: string;

  constructor(options: PlatformClientOptions) {
    // Trim a single trailing slash so callers can pass either form.
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.token = options.token;
  }

  setToken(token: string): void {
    this.token = token;
  }

  /**
   * Authenticate against the platform. On success, stores the returned token
   * internally (so subsequent calls are authorized) and returns the user.
   */
  async login(email: string, password: string): Promise<User> {
    const data = await this.request<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
    this.token = data.token;
    return data.user;
  }

  listCertifications(): Promise<Certification[]> {
    return this.request<Certification[]>("/api/certifications");
  }

  getTrilha(slug: string): Promise<Trilha> {
    return this.request<Trilha>(`/api/certifications/${encodeURIComponent(slug)}`);
  }

  getLesson(id: string): Promise<Lesson> {
    return this.request<Lesson>(`/api/lessons/${encodeURIComponent(id)}`);
  }

  dueReviews(): Promise<DueReview[]> {
    return this.request<DueReview[]>("/api/reviews/due");
  }

  gradeFlashcard(flashcardId: string, grade: Grade): Promise<GradeResult> {
    return this.request<GradeResult>(
      `/api/reviews/${encodeURIComponent(flashcardId)}/grade`,
      { method: "POST", body: { grade } },
    );
  }

  getQuiz(cert: string, n: number): Promise<QuizQuestion[]> {
    const qs = new URLSearchParams({ cert, n: String(n) });
    return this.request<QuizQuestion[]>(`/api/quiz?${qs.toString()}`);
  }

  answerQuestion(questionId: string, chosenIndex: number): Promise<AnswerResult> {
    return this.request<AnswerResult>("/api/quiz/answer", {
      method: "POST",
      body: { questionId, chosenIndex },
    });
  }

  myMastery(cert: string): Promise<MasteryMap> {
    const qs = new URLSearchParams({ cert });
    return this.request<MasteryMap>(`/api/me/mastery?${qs.toString()}`);
  }

  /**
   * Core request helper. Builds headers, serializes JSON bodies, and throws a
   * descriptive Error on any non-2xx response.
   */
  private async request<T>(
    path: string,
    opts: {
      method?: "GET" | "POST";
      body?: unknown;
      auth?: boolean;
    } = {},
  ): Promise<T> {
    const { method = "GET", body, auth = true } = opts;

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (auth && this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Network error calling ${method} ${path}: ${message}`);
    }

    const raw = await res.text();
    let parsed: unknown = undefined;
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = raw;
      }
    }

    if (!res.ok) {
      const errMsg =
        parsed && typeof parsed === "object" && "error" in parsed
          ? String((parsed as { error: unknown }).error)
          : typeof parsed === "string" && parsed
            ? parsed
            : res.statusText;
      throw new Error(
        `Request ${method} ${path} failed (${res.status}): ${errMsg}`,
      );
    }

    return parsed as T;
  }
}

export function createPlatformClient(
  options: PlatformClientOptions,
): PlatformClient {
  return new PlatformClient(options);
}
