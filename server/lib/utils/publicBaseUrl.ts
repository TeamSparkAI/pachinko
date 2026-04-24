import type { NextRequest } from "next/server";

/** Trim and strip trailing slashes from a configured public base URL. */
export function normalizeExternalBaseUrl(value: string | undefined | null): string {
    return (value ?? "").trim().replace(/\/+$/, "");
}

/**
 * Infer the browser-reachable origin for this request (reverse-proxy aware).
 * Used when `externalBaseUrl` is not configured.
 */
export function resolvePublicBaseUrlFromRequest(request: NextRequest): string {
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const forwardedHost = request.headers.get("x-forwarded-host");
    if (forwardedProto?.trim() && forwardedHost?.trim()) {
        const proto = forwardedProto.split(",")[0].trim();
        const host = forwardedHost.split(",")[0].trim();
        return `${proto}://${host}`;
    }
    const { protocol, host } = request.nextUrl;
    return `${protocol}//${host}`;
}
