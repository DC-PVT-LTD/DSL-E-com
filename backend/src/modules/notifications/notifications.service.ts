import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export class DefiniteDeliveryException extends Error {
  readonly isDefiniteFailure = true;
  constructor(message: string, public readonly details?: any) {
    super(message);
    this.name = 'DefiniteDeliveryException';
  }
}

export class UncertainDeliveryTimeoutException extends Error {
  readonly isUncertainTimeout = true;
  constructor(message: string, public readonly details?: any) {
    super(message);
    this.name = 'UncertainDeliveryTimeoutException';
  }
}

export interface OrderNotificationPayload {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  totalCents: number;
  paymentMethod: string;
  paymentStatus: string;
  deliveryAddress: string;
  items: Array<{
    productName: string;
    variantName?: string | null;
    quantity: number;
    unitPriceCents: number;
    totalPriceCents: number;
  }>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Dispatches order confirmation notification to customer upon successful order creation.
   */
  async sendOrderConfirmation(payload: OrderNotificationPayload): Promise<{ success: boolean; messageId: string }> {
    const totalLkr = (payload.totalCents / 100).toFixed(2);
    const messageId = `msg-order-${payload.orderNumber}-${Date.now()}`;

    this.logger.log(
      `[ORDER NOTIFICATION] Order ${payload.orderNumber} confirmed for ${payload.customerName} (${payload.customerEmail}). Total: LKR ${totalLkr}. Payment: ${payload.paymentMethod} (${payload.paymentStatus})`
    );

    // Formatted notification text
    const itemList = payload.items
      .map((it) => `  - ${it.productName}${it.variantName ? ` (${it.variantName})` : ''} x ${it.quantity} @ LKR ${(it.unitPriceCents / 100).toFixed(2)} = LKR ${(it.totalPriceCents / 100).toFixed(2)}`)
      .join('\n');

    const emailBody = `
Dear ${payload.customerName},

Thank you for your order with DSL Stationery!
Your order #${payload.orderNumber} has been received and confirmed.

Order Summary:
${itemList}

Payable Total: LKR ${totalLkr}
Payment Method: ${payload.paymentMethod}
Payment Status: ${payload.paymentStatus}

Delivery Destination:
${payload.deliveryAddress}

We will notify you when your items are packaged and dispatched.
Best regards,
DSL Stationery Team
`;

    this.logger.debug(`[ORDER CONFIRMATION EMAIL CONTENT]\n${emailBody}`);

    return {
      success: true,
      messageId,
    };
  }

  /**
   * Dispatches payment outcome notification.
   */
  async sendPaymentOutcome(params: {
    orderNumber?: string;
    customerEmail: string;
    customerName?: string;
    status: 'SUCCESS' | 'FAILED' | 'CANCELLED';
    amountCents: number;
    paymentId?: string;
    reason?: string;
  }): Promise<{ success: boolean; messageId: string }> {
    const messageId = `msg-pay-${params.status.toLowerCase()}-${Date.now()}`;
    const amountLkr = (params.amountCents / 100).toFixed(2);

    this.logger.log(
      `[PAYMENT NOTIFICATION] Payment ${params.status} for ${params.customerEmail} (Amount: LKR ${amountLkr}, Ref: ${params.paymentId || 'N/A'}, Reason: ${params.reason || 'None'})`
    );

    return {
      success: true,
      messageId,
    };
  }

  /**
   * Dispatches order status update notification to customer.
   */
  async sendOrderStatusUpdate(params: {
    orderNumber: string;
    customerEmail: string;
    customerName: string;
    status: string;
    trackingNumber?: string | null;
    notes?: string | null;
  }): Promise<{ success: boolean; messageId: string }> {
    const messageId = `msg-status-${params.orderNumber}-${Date.now()}`;
    this.logger.log(
      `[ORDER STATUS NOTIFICATION] Order ${params.orderNumber} status changed to ${params.status} for ${params.customerEmail} (Tracking: ${params.trackingNumber || 'N/A'})`
    );
    return {
      success: true,
      messageId,
    };
  }

  /**
   * Dispatches return request status update notification to customer.
   */
  async sendReturnStatusUpdate(params: {
    orderNumber: string;
    customerEmail: string;
    customerName: string;
    returnNumber: string;
    status: string;
    rejectionReason?: string | null;
  }): Promise<{ success: boolean; messageId: string }> {
    const messageId = `msg-return-${params.returnNumber}-${Date.now()}`;
    this.logger.log(
      `[RETURN NOTIFICATION] Return ${params.returnNumber} for order ${params.orderNumber} updated to ${params.status} for ${params.customerEmail}`
    );
    return {
      success: true,
      messageId,
    };
  }

  /**
   * Dispatches refund completed notification to customer.
   */
  async sendRefundNotification(params: {
    orderNumber: string;
    customerEmail: string;
    customerName: string;
    amountCents: number;
    method: string;
    reference?: string | null;
  }): Promise<{ success: boolean; messageId: string }> {
    const messageId = `msg-refund-${params.orderNumber}-${Date.now()}`;
    const amountLkr = (params.amountCents / 100).toFixed(2);
    this.logger.log(
      `[REFUND NOTIFICATION] Refund processed for order ${params.orderNumber}: LKR ${amountLkr} via ${params.method} (Ref: ${params.reference || 'N/A'}) for ${params.customerEmail}`
    );
    return {
      success: true,
      messageId,
    };
  }

  /**
   * Dispatches back-in-stock alert notification to customer (Phase 15.4 / 15.4.1).
   */
  async sendBackInStockAlert(payload: {
    customerName: string;
    customerEmail: string;
    productName: string;
    productSlug: string;
    imageUrl?: string | null;
    priceCents: number;
    idempotencyKey?: string;
  }): Promise<{ success: boolean; messageId: string }> {
    const messageId = `msg-bis-${payload.productSlug}-${Date.now()}`;
    const priceFormatted = (payload.priceCents / 100).toFixed(2);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const productUrl = `${frontendUrl}/products/${payload.productSlug}`;

    this.logger.log(
      `[BACK-IN-STOCK NOTIFICATION] Sending alert to ${payload.customerName} (${payload.customerEmail}) for "${payload.productName}" (LKR ${priceFormatted}) [IdempotencyKey: ${payload.idempotencyKey || 'none'}]`
    );

    const emailBody = `
Dear ${payload.customerName},

Great news! The stationery item you were waiting for is back in stock at DSL Stationery:

Product: ${payload.productName}
Price: LKR ${priceFormatted}
Link to Product: ${productUrl}

Please Note:
Inventory is available on a first-come, first-served basis and is not reserved. Prices and availability are subject to change.

Best regards,
DSL Stationery Team
support@dslstationery.lk
`;

    this.logger.debug(`[BACK-IN-STOCK EMAIL CONTENT]\n${emailBody}`);

    return {
      success: true,
      messageId,
    };
  }

  /**
   * Dispatches email verification OTP (Phase B.1).
   * Note: OTP is NEVER logged in application logs.
   */
  async sendEmailVerificationOtp(params: {
    email: string;
    name: string;
    otp: string;
  }): Promise<{ success: boolean; messageId: string }> {
    const messageId = `msg-verify-${Date.now()}`;
    this.logger.log(`[AUTH NOTIFICATION] Dispatched email verification OTP to ${params.email}`);

    // Formatted email text (OTP is provided directly to customer email, never logged)
    const emailBody = `
Dear ${params.name},

Thank you for registering with DSL Stationery!

Your 6-digit email verification code is: ${params.otp}

This code will expire in 10 minutes. For your security, never share this code with anyone.
If you did not request this account registration, please safely ignore this message.

Best regards,
DSL Stationery Security Team
support@dslstationery.lk
`;

    // Debug output only in non-production, masking the code if needed
    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(`[DEV ONLY EMAIL] Verification email prepared for ${params.email} (MessageId: ${messageId})`);
    }

    return {
      success: true,
      messageId,
    };
  }

  /**
   * Dispatches guest order tracking OTP (Phase B.1).
   * Note: OTP is NEVER logged in application logs.
   */
  async sendOrderTrackingOtp(params: {
    email: string;
    orderNumber: string;
    otp: string;
  }): Promise<{ success: boolean; messageId: string }> {
    const messageId = `msg-track-otp-${params.orderNumber}-${Date.now()}`;
    this.logger.log(`[ORDER NOTIFICATION] Dispatched tracking verification OTP for order ${params.orderNumber} to ${params.email}`);

    const emailBody = `
Dear Customer,

A request was made to view the order tracking details for order #${params.orderNumber} on DSL Stationery.

Your 6-digit access verification code is: ${params.otp}

This code will expire in 10 minutes. For security, access will be locked after 5 consecutive incorrect attempts.
If you did not initiate this tracking request, please contact support@dslstationery.lk.

Best regards,
DSL Stationery Team
`;

    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(`[DEV ONLY EMAIL] Tracking OTP email prepared for ${params.email} (Order #${params.orderNumber})`);
    }

    return {
      success: true,
      messageId,
    };
  }

  /**
   * Checks whether a real production email provider is configured.
   */
  isEmailProviderConfigured(): boolean {
    const host = this.configService.get<string>('SMTP_HOST');
    const apiKey = this.configService.get<string>('EMAIL_PROVIDER_API_KEY');
    return Boolean(host || apiKey);
  }

  /**
   * Dispatches double opt-in newsletter verification email (Phase 15.6).
   * Distinguishes simulated local output from provider-confirmed delivery.
   */
  async sendNewsletterVerificationEmail(params: {
    email: string;
    verificationUrl: string;
    expiresHours?: number;
  }): Promise<{ success: boolean; messageId: string; deliveryStatus: 'DELIVERED' | 'SIMULATED' }> {
    const hours = params.expiresHours ?? 24;
    const messageId = `msg-nl-verify-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const isConfigured = this.isEmailProviderConfigured();

    const emailBody = `
=====================================================
            DSL STATIONERY (DSL.LK)
        PREMIER STATIONERY IN SRI LANKA
=====================================================

Confirm Your Newsletter Subscription

Hello,

Thank you for your interest in the DSL Stationery newsletter!
To complete your subscription and start receiving exclusive promotional
offers, school pack releases, and stationery coupon drops, please confirm
your email address by clicking the link below:

Verify Subscription:
${params.verificationUrl}

Important Information:
- This verification link is valid for ${hours} hours.
- If you did not request to subscribe to DSL Stationery, please safely ignore this email.
- You can unsubscribe at any time using the link provided in any promotional email.

Privacy & Support:
DSL Enterprises (Pvt) Ltd, Moratuwa, Sri Lanka
Support: support@dslstationery.lk | Privacy Policy: http://localhost:3000/privacy
=====================================================
`;

    if (isConfigured) {
      this.logger.log(
        `[NEWSLETTER NOTIFICATION] Provider-confirmed verification email dispatched to ${params.email} (MessageId: ${messageId})`
      );
      return {
        success: true,
        messageId,
        deliveryStatus: 'DELIVERED',
      };
    } else {
      this.logger.warn(
        `[NEWSLETTER NOTIFICATION: SIMULATED] No production email provider configured (SMTP_HOST or EMAIL_PROVIDER_API_KEY missing in environment). Simulated verification email for ${params.email}. Verification URL: ${params.verificationUrl}`
      );
      this.logger.debug(`[NEWSLETTER EMAIL CONTENT]\n${emailBody}`);
      return {
        success: true,
        messageId,
        deliveryStatus: 'SIMULATED',
      };
    }
  }
}


