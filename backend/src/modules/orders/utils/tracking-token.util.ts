import * as crypto from 'crypto';

export interface TrackingTokenPayload {
  orderId: string;
  orderNumber: string;
  email: string;
  exp: number;
}

/**
 * Generates an HMAC-SHA256 cryptographically signed, expiring (30 days) guest order tracking token.
 */
export function generateTrackingToken(
  order: { id: string; orderNumber: string; customerEmail?: string | null },
  secret: string = process.env.JWT_SECRET || 'dsl_order_tracking_default_secret_key'
): string {
  const email = (order?.customerEmail || '').toLowerCase().trim();
  const payload: TrackingTokenPayload = {
    orderId: order?.id || '',
    orderNumber: order?.orderNumber || '',
    email,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30-day validity
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

/**
 * Validates a guest order tracking token against an order.
 * Ensures the signature is valid, token is not expired, and order/email match.
 */
export function verifyTrackingToken(
  token: string | null | undefined,
  order: { id: string; orderNumber: string; customerEmail?: string | null },
  secret: string = process.env.JWT_SECRET || 'dsl_order_tracking_default_secret_key'
): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 2) {
      return false;
    }

    const [payloadB64, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(payloadB64)
      .digest('base64url');

    // Constant-time comparison
    if (
      signature.length !== expectedSig.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))
    ) {
      return false;
    }

    const payload: TrackingTokenPayload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf-8')
    );

    // Verify token expiry
    if (!payload.exp || Date.now() > payload.exp) {
      return false;
    }

    // Verify order matching
    const orderEmail = (order?.customerEmail || '').toLowerCase().trim();
    const emailMatches = payload.email && payload.email === orderEmail;
    const orderMatches =
      (payload.orderId && payload.orderId === order?.id) ||
      (payload.orderNumber && payload.orderNumber === order?.orderNumber);

    return Boolean(emailMatches && orderMatches);
  } catch {
    return false;
  }
}
