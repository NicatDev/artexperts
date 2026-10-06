import { siteConfig } from "@/config/site";

export interface ApiResponse<T> {
  data?: T;
  error?: {
    message: string;
    details?: any;
    code?: string;
  };
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const internalApi = typeof window === "undefined" ? process.env.API_INTERNAL_URL : undefined;
  const baseUrl = internalApi || siteConfig.apiUrl;
  const url = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const defaultHeaders: Record<string, string> = {
    "Accept": "application/json",
  };
  // Keep generated media URLs public when SSR reaches Django through Docker DNS.
  if (internalApi && !endpoint.startsWith("http")) {
    const publicBackend = new URL(siteConfig.backendUrl);
    defaultHeaders.Host = publicBackend.host;
    defaultHeaders["X-Forwarded-Proto"] = publicBackend.protocol.slice(0, -1);
  }
  const hasBody = options.body !== undefined && options.body !== null;
  const method = (options.method || (hasBody ? "POST" : "GET")).toUpperCase();
  const isSafeMethod = ["GET", "HEAD", "OPTIONS"].includes(method);
  const isPrivateEndpoint = endpoint.startsWith("/auth/") || endpoint.includes("/my/") || endpoint.includes("/manage/");
  let csrfToken = typeof document !== "undefined"
    ? document.cookie.split("; ").find((cookie) => cookie.startsWith("csrftoken="))?.split("=").slice(1).join("=")
    : undefined;
  if (!isSafeMethod && !csrfToken) {
    try {
      const csrfResponse = await fetch(`${siteConfig.apiUrl}/auth/csrf/`, { credentials: "include", cache: "no-store" });
      const csrfData = await csrfResponse.json();
      csrfToken = csrfData?.csrfToken;
    } catch {
      // The request will return a normal API error if CSRF bootstrap is unavailable.
    }
  }
  if (!isSafeMethod && csrfToken) defaultHeaders["X-CSRFToken"] = decodeURIComponent(csrfToken);

  // Only set Content-Type to json if body is not FormData
  if (hasBody && !(options.body instanceof FormData)) {
    defaultHeaders["Content-Type"] = "application/json";
  }

  const headers = new Headers(options.headers);
  for (const [key, value] of Object.entries(defaultHeaders)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  const visitorId = typeof window !== "undefined" ? window.localStorage.getItem("art-experts-visitor") : null;
  if (visitorId && !headers.has("X-Art-Experts-Visitor")) headers.set("X-Art-Experts-Visitor", visitorId);

  const response = await fetch(url, {
    ...options,
    credentials: "include", // Required for HttpOnly session cookies
    headers,
    // Next.js caching control: revalidate after 30 seconds for public feeds
    ...(isSafeMethod && !isPrivateEndpoint ? { next: { revalidate: 30 } } : { cache: "no-store" as const }),
  });

  const newVisitorId = response.headers.get("X-Art-Experts-Visitor");
  if (newVisitorId && typeof window !== "undefined") window.localStorage.setItem("art-experts-visitor", newVisitorId);

  if (!response.ok) {
    let errorData: any = {};
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: `Request failed with status ${response.status}` };
    }
    const message = errorData?.error?.message || errorData?.message || `Error ${response.status}`;
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export const api = {
  getMyContent: (kind: "artworks" | "articles" | "books", page: number = 1, lang: string = "az") =>
    request<any>(`/${kind}/my/?page=${page}&lang=${lang}`),
  getManagedContent: (kind: "artworks" | "articles" | "books", id: string) =>
    request<any>(`/${kind}/${id}/manage/`),
  saveContent: (kind: "artworks" | "articles" | "books", data: FormData, id?: string) =>
    request<any>(id ? `/${kind}/${id}/manage/` : `/${kind}/publish/`, { method: id ? "PATCH" : "POST", body: data }),
  deleteContent: (kind: "artworks" | "articles" | "books", id: string) =>
    request<void>(`/${kind}/${id}/manage/`, { method: "DELETE" }),
  // Home & Pages
  getHomeOverview: (lang: string = "az") => request<any>(`/pages/home-overview/?lang=${lang}`),
  getAboutPage: (lang: string = "az") => request<any>(`/pages/about/?lang=${lang}`),
  getSiteSettings: () => request<any>(`/pages/settings/`),

  // Artworks
  getArtworks: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<any>(`/artworks/${qs ? `?${qs}` : ""}`);
  },
  getBookCategories: (lang: string = "az") => request<any>(`/books/categories/?lang=${lang}`),
  getArtworkCategories: (lang: string = "az") => request<any>(`/artworks/categories/?lang=${lang}`),
  getArtworkDetail: (id: string, lang: string = "az") => request<any>(`/artworks/${id}/?lang=${lang}`),
  publishArtwork: (formData: FormData) => request<any>(`/artworks/publish/`, { method: "POST", body: formData }),
  getMyArtworks: () => request<any>(`/artworks/my/`),
  deleteArtwork: (id: string) => request<any>(`/artworks/${id}/manage/`, { method: "DELETE" }),

  // Articles
  getArticles: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<any>(`/articles/${qs ? `?${qs}` : ""}`);
  },
  getArticleCategories: (lang: string = "az") => request<any>(`/articles/categories/?lang=${lang}`),
  getArticleDetail: (slugOrId: string, lang: string = "az") => request<any>(`/articles/${slugOrId}/?lang=${lang}`),
  publishArticle: (formData: FormData) => request<any>(`/articles/publish/`, { method: "POST", body: formData }),
  getMyArticles: () => request<any>(`/articles/my/`),
  deleteArticle: (id: string) => request<any>(`/articles/${id}/manage/`, { method: "DELETE" }),

  // Books
  getBooks: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<any>(`/books/${qs ? `?${qs}` : ""}`);
  },
  getBookDetail: (slugOrId: string, lang: string = "az") => request<any>(`/books/${slugOrId}/?lang=${lang}`),
  publishBook: (formData: FormData) => request<any>(`/books/publish/`, { method: "POST", body: formData }),
  getMyBooks: () => request<any>(`/books/my/`),
  deleteBook: (id: string) => request<any>(`/books/${id}/manage/`, { method: "DELETE" }),
  grantBookAccess: (bookId: string, email: string, expiresInDays?: number) =>
    request<any>(`/books/${bookId}/grant-access/`, {
      method: "POST",
      body: JSON.stringify({ email, expires_in_days: expiresInDays }),
    }),

  // Artists
  getArtists: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<any>(`/artists/${qs ? `?${qs}` : ""}`);
  },
  getArtistDetail: (username: string) => request<any>(`/artists/${username}/`),

  // Search
  search: (query: string, type: string = "all") =>
    request<any>(`/search/?q=${encodeURIComponent(query)}&type=${type}`),

  // Auth & Profile
  requestVerificationCode: (email: string) =>
    request<any>(`/auth/register/request-code/`, { method: "POST", body: JSON.stringify({ email }) }),
  requestPasswordReset: (email: string) =>
    request<{ message: string; development_code?: string }>(`/auth/password-reset/request-code/`, { method: "POST", body: JSON.stringify({ email }) }),
  confirmPasswordReset: (email: string, code: string, new_password: string) =>
    request<{ message: string }>(`/auth/password-reset/confirm/`, { method: "POST", body: JSON.stringify({ email, code, new_password }) }),
  verifyAndRegister: (data: any, csrfToken?: string) =>
    request<any>(`/auth/register/verify/`, { method: "POST", headers: csrfToken ? { "X-CSRFToken": csrfToken } : {}, body: JSON.stringify(data) }),
  login: async (data: any) => {
    const csrf = await request<any>(`/auth/csrf/`);
    return request<any>(`/auth/login/`, { method: "POST", headers: { "X-CSRFToken": csrf.csrfToken }, body: JSON.stringify(data) });
  },
  logout: () =>
    request<any>(`/auth/logout/`, { method: "POST" }),
  getCurrentUser: () =>
    request<any>(`/auth/me/`),
  getCsrfToken: () => request<any>(`/auth/csrf/`),
  updateProfile: (data: FormData | Record<string, unknown>) =>
    request<any>(`/auth/me/`, { method: "PATCH", body: data instanceof FormData ? data : JSON.stringify(data) }),
  lookupUser: (email: string) =>
    request<{ exists: boolean; username?: string; full_name?: string; avatar_thumbnail?: string }>(
      `/users/lookup/?email=${encodeURIComponent(email)}`
    ),
};
