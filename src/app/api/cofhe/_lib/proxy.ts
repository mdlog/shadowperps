import type { NextRequest } from "next/server";

type UpstreamService = "cofhe" | "verifier" | "threshold";

const DEFAULT_UPSTREAMS: Record<UpstreamService, string> = {
  cofhe: "https://testnet-cofhe.fhenix.zone",
  verifier: "https://testnet-cofhe-vrf.fhenix.zone",
  threshold: "https://testnet-cofhe-tn.fhenix.zone",
};

function getUpstreamBaseUrl(service: UpstreamService) {
  switch (service) {
    case "cofhe":
      return process.env.COFHE_PUBLIC_KEY_URL || DEFAULT_UPSTREAMS.cofhe;
    case "verifier":
      return process.env.COFHE_VERIFIER_URL || DEFAULT_UPSTREAMS.verifier;
    case "threshold":
      return process.env.COFHE_THRESHOLD_URL || DEFAULT_UPSTREAMS.threshold;
  }
}

function buildTargetUrl(service: UpstreamService, path: string[], requestUrl: string) {
  const baseUrl = getUpstreamBaseUrl(service).replace(/\/+$/, "");
  const target = new URL(`${baseUrl}/${path.join("/")}`);
  const sourceUrl = new URL(requestUrl);
  target.search = sourceUrl.search;
  return target;
}

function buildProxyHeaders(request: NextRequest) {
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const accept = request.headers.get("accept");

  if (contentType) {
    headers.set("content-type", contentType);
  }

  if (accept) {
    headers.set("accept", accept);
  }

  return headers;
}

async function buildRequestInit(request: NextRequest): Promise<RequestInit> {
  const method = request.method;
  if (method === "GET" || method === "HEAD") {
    return {
      method,
      headers: buildProxyHeaders(request),
      cache: "no-store",
      redirect: "follow",
    };
  }

  return {
    method,
    headers: buildProxyHeaders(request),
    body: await request.text(),
    cache: "no-store",
    redirect: "follow",
  };
}

export async function proxyCofheRequest(
  request: NextRequest,
  service: UpstreamService,
  path: string[],
) {
  const targetUrl = buildTargetUrl(service, path, request.url);

  try {
    const upstream = await fetch(targetUrl, await buildRequestInit(request));
    const responseHeaders = new Headers();
    const contentType = upstream.headers.get("content-type");

    if (contentType) {
      responseHeaders.set("content-type", contentType);
    }
    responseHeaders.set("cache-control", "no-store");

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown proxy error";
    return Response.json(
      {
        error: `Failed to reach CoFHE upstream: ${message}`,
        upstream: targetUrl.toString(),
      },
      { status: 502 },
    );
  }
}
