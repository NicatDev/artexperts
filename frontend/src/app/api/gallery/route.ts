import { api, ApiError } from "@/lib/api";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const params: Record<string, string> = { ordering: "gallery" };
  for (const field of ["category", "search", "founder", "lang", "page"]) {
    const value = query.get(field);
    if (value) params[field] = value;
  }

  try {
    const data = await api.getArtworks(params, { cache: "no-store", signal: request.signal });
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return new Response(null, { status: 404, headers: { "Cache-Control": "no-store", "X-Gallery-End": "1" } });
    }
    if (!request.signal.aborted) console.warn("[gallery]", error);
    return new Response(null, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
