import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL_USER, API_KEY } from '@/lib/config';
import { getServerDomainTokenCached, invalidateServerDomainToken } from '@/lib/serverTokenCache';

/** Path segment for `GET .../api/internal/flights/bookings/{app_reference}/ticket.pdf` — numeric id or ref e.g. JV26-99389629-351408 */
function normalizeAppReferenceSegment(raw: string): string {
  const s = String(raw ?? "").trim();
  if (!s || s.length > 256) return "";
  if (/^\d+$/.test(s)) return s;
  if (/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(s)) return s;
  return "";
}

function extractAppReference(input: any): string {
  if (input == null) return "";
  if (typeof input === "string" || typeof input === "number") {
    return normalizeAppReferenceSegment(String(input));
  }
  const seen = new Set<any>();
  const stack: any[] = [input];
  while (stack.length) {
    const v = stack.pop();
    if (v == null || typeof v !== "object") continue;
    if (seen.has(v)) continue;
    seen.add(v);
    if (Array.isArray(v)) {
      for (const x of v) stack.push(x);
      continue;
    }
    for (const [k, val] of Object.entries(v)) {
      if (/app_reference|appreference|bookingid|bookid|bookingref/i.test(k)) {
        const id = normalizeAppReferenceSegment(String(val ?? ""));
        if (id) return id;
      }
      stack.push(val);
    }
  }
  return "";
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawAppReference =
      searchParams.get('app_reference')?.trim() ||
      searchParams.get('appReference')?.trim() ||
      searchParams.get('bookingId')?.trim() ||
      '';
    // For security + consistency, always use server-side domain token.
    // (Do not accept tokens via query string.)

    console.log('=== FLIGHT TICKET PDF API ===');
    console.log('app_reference (raw):', rawAppReference);
    console.log('Auth: server domain token');
    console.log('================================');

    if (!rawAppReference) {
      return NextResponse.json({ error: 'app_reference is required' }, { status: 400 });
    }

    const pdfUrl = (appRef: string) =>
      `${API_BASE_URL_USER}/api/internal/flights/bookings/${encodeURIComponent(appRef)}/ticket.pdf`;

    const doFetchPdf = (bearer: string, appRef: string) =>
      fetch(pdfUrl(appRef), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': API_KEY,
          Authorization: `Bearer ${bearer}`,
        },
      });

    let bearer = await getServerDomainTokenCached();

    // Prefer explicit path segment (numeric or ref like JV26-99389629-351408).
    let appRef = normalizeAppReferenceSegment(rawAppReference);

    // If still missing, resolve via flight-booking/show/{app_reference}
    if (!appRef) {
      const showUrl = `${API_BASE_URL_USER}/flight-booking/show/${encodeURIComponent(rawAppReference)}`;
      const showFetch = (token: string) =>
        fetch(showUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": API_KEY,
            Authorization: `Bearer ${token}`,
          },
        });

      let showRes = await showFetch(bearer);
      if (showRes.status === 401) {
        console.warn('[ticket-pdf] 401 while resolving app_reference — refreshing and retrying');
        invalidateServerDomainToken();
        bearer = await getServerDomainTokenCached();
        showRes = await showFetch(bearer);
      }
      if (!showRes.ok) {
        const errorText = await showRes.text();
        return NextResponse.json({ error: `Unable to resolve app_reference. HTTP ${showRes.status}: ${errorText}` }, { status: showRes.status });
      }
      const showJson = await showRes.json().catch(() => null);
      appRef = extractAppReference(showJson);
    }

    if (!appRef) {
      return NextResponse.json({ error: 'app_reference not found for this booking.' }, { status: 400 });
    }

    console.log('URL:', pdfUrl(appRef));

    let response = await doFetchPdf(bearer, appRef);

    if (response.status === 401) {
      console.warn('[ticket-pdf] 401 with server token — refreshing and retrying');
      invalidateServerDomainToken();
      bearer = await getServerDomainTokenCached();
      response = await doFetchPdf(bearer, appRef);
    }

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: `HTTP ${response.status}: ${errorText}` }, { status: response.status });
    }

    const pdfBuffer = await response.arrayBuffer();
    
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="ticket-${appRef}.pdf"`
      }
    });
  } catch (error: unknown) {
    let message = 'Unknown error';
    if (error instanceof Error) {
      message = error.message;
    }
    return NextResponse.json({ error: `PDF generation failed: ${message}` }, { status: 500 });
  }
}