import { NextRequest, NextResponse } from 'next/server';

// Build the public-facing base URL from request headers.
// request.url uses the internal server address (e.g. http://0.0.0.0:3000) which
// is unreachable from the browser. The real public hostname is in the Host header.
function getPublicBase(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}

// HDFC Smart Gateway POSTs payment result to this endpoint after the user pays.
// We extract the order_id and redirect the browser to the payment page as a GET
// so our client-side handler can pick it up cleanly.
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let orderId = '';

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await request.text();
      const params = new URLSearchParams(text);
      orderId = params.get('order_id') || params.get('orderId') || params.get('orderid') || '';
      console.log('[hdfc-return] POST form body params:', Object.fromEntries(params.entries()));
    } else if (contentType.includes('application/json')) {
      const body = await request.json();
      orderId = body.order_id || body.orderId || body.orderid || '';
      console.log('[hdfc-return] POST JSON body:', body);
    } else {
      const text = await request.text();
      console.log('[hdfc-return] POST raw body:', text);
      try {
        const params = new URLSearchParams(text);
        orderId = params.get('order_id') || params.get('orderId') || params.get('orderid') || '';
      } catch {}
    }

    const base = getPublicBase(request);
    const redirectUrl = `${base}/flights/payment?hdfc_return=1&orderId=${encodeURIComponent(orderId)}`;
    console.log('[hdfc-return] Redirecting to:', redirectUrl);
    // 303 See Other converts the POST into a GET for the browser redirect
    return NextResponse.redirect(redirectUrl, { status: 303 });
  } catch (error) {
    console.error('[hdfc-return] Error handling POST:', error);
    const base = getPublicBase(request);
    return NextResponse.redirect(`${base}/flights/payment?hdfc_return=1&orderId=`, { status: 303 });
  }
}

// Handle GET too in case the gateway uses a redirect instead of form POST
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get('order_id') || searchParams.get('orderId') || searchParams.get('orderid') || '';
  const base = getPublicBase(request);
  const redirectUrl = `${base}/flights/payment?hdfc_return=1&orderId=${encodeURIComponent(orderId)}`;
  console.log('[hdfc-return] GET redirecting to:', redirectUrl);
  return NextResponse.redirect(redirectUrl, { status: 303 });
}
