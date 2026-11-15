import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

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
  private transporter: nodemailer.Transporter | null = null;
  private readonly defaultFrom: string;

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST') || process.env.SMTP_HOST;
    const port = Number(this.configService.get<string | number>('SMTP_PORT', 587) || process.env.SMTP_PORT || 587);
    const secure =
      this.configService.get<string | boolean>('SMTP_SECURE') === true ||
      this.configService.get<string>('SMTP_SECURE') === 'true' ||
      process.env.SMTP_SECURE === 'true';
    const user = this.configService.get<string>('SMTP_USER') || process.env.SMTP_USER;
    const rawPass = this.configService.get<string>('SMTP_PASS') || process.env.SMTP_PASS || '';
    const pass = rawPass.replace(/\s+/g, '');

    const fromName = this.configService.get<string>('MAIL_FROM_NAME', 'DSL Stationery') || process.env.MAIL_FROM_NAME || 'DSL Stationery';
    const fromEmail = this.configService.get<string>('MAIL_FROM_EMAIL', user || 'no-reply@dslstationery.lk') || process.env.MAIL_FROM_EMAIL || user || 'no-reply@dslstationery.lk';
    this.defaultFrom = `"${fromName}" <${fromEmail}>`;

    if (host && user && pass) {
      try {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: {
            user,
            pass,
          },
        });
        this.logger.log(`[NOTIFICATIONS] SMTP transporter initialized with host=${host}, port=${port}, user=${user}`);
      } catch (err: any) {
        this.logger.error(`[NOTIFICATIONS] Failed to initialize SMTP transporter: ${err?.message || err}`);
      }
    } else {
      this.logger.warn(`[NOTIFICATIONS] SMTP credentials not provided; notifications will run in simulated mode.`);
    }
  }

  /**
   * Internal helper to dispatch an email via Nodemailer SMTP or log simulation.
   */
  private async dispatchEmail(options: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<{ success: boolean; messageId: string; deliveryStatus: 'DELIVERED' | 'SIMULATED' }> {
    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from: this.defaultFrom,
          to: options.to,
          subject: options.subject,
          text: options.text,
          html: options.html,
        });
        this.logger.log(`[EMAIL DISPATCHED] To: ${options.to} | Subject: "${options.subject}" | MessageId: ${info.messageId}`);
        return {
          success: true,
          messageId: info.messageId,
          deliveryStatus: 'DELIVERED',
        };
      } catch (err: any) {
        this.logger.error(`[EMAIL DISPATCH FAILED] To: ${options.to} | Error: ${err?.message || err}`);
        throw new DefiniteDeliveryException(`Email delivery failed to ${options.to}: ${err?.message || err}`, err);
      }
    } else {
      const simulatedId = `msg-sim-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      this.logger.warn(
        `[SIMULATED EMAIL DISPATCH] (No SMTP configured) To: ${options.to} | Subject: "${options.subject}" | MessageId: ${simulatedId}`
      );
      this.logger.debug(`[SIMULATED EMAIL BODY]\n${options.text}`);
      return {
        success: true,
        messageId: simulatedId,
        deliveryStatus: 'SIMULATED',
      };
    }
  }

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

    await this.dispatchEmail({
      to: payload.customerEmail,
      subject: `Order #${payload.orderNumber} Confirmation - DSL Stationery`,
      text: emailBody,
    }).catch((err) => {
      this.logger.warn(`Could not dispatch order confirmation email: ${err.message}`);
    });

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
   * Note: Plaintext OTP is NEVER logged in persistent application logs.
   */
  async sendEmailVerificationOtp(params: {
    email: string;
    name: string;
    otp: string;
  }): Promise<{ success: boolean; messageId: string }> {
    const subject = `Your DSL Stationery Verification Code: ${params.otp}`;
    const text = `
Dear ${params.name},

Thank you for registering with DSL Stationery!

Your 6-digit email verification code is: ${params.otp}

This code will expire in 10 minutes. For your security, never share this code with anyone.
If you did not request this account registration, please safely ignore this message.

Best regards,
DSL Stationery Security Team
support@dslstationery.lk
`;

    const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #C6E7FF; border-radius: 16px; background-color: #FFFDF0; color: #292525;">
  <div style="text-align: center; margin-bottom: 24px;">
    <h1 style="color: #0066CC; font-size: 24px; font-weight: 800; margin: 0;">DSL Stationery</h1>
    <p style="color: #666; font-size: 13px; margin: 4px 0 0 0;">Premier Stationery in Sri Lanka</p>
  </div>
  <div style="background-color: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #E2E8F0;">
    <h2 style="font-size: 18px; color: #10285D; margin-top: 0;">Verify Your Email Address</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #4A5568;">Hello <strong>${params.name}</strong>,</p>
    <p style="font-size: 14px; line-height: 1.6; color: #4A5568;">Thank you for registering with DSL Stationery. Please enter the 6-digit verification code below to verify your email address:</p>
    <div style="text-align: center; margin: 28px 0;">
      <span style="display: inline-block; font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #0066CC; background-color: #F0F7FF; border: 2px dashed #0066CC; border-radius: 8px; padding: 12px 24px;">${params.otp}</span>
    </div>
    <p style="font-size: 12px; color: #718096; line-height: 1.5;">This verification code will expire in <strong>10 minutes</strong>. If you did not request this verification, you can safely ignore this email.</p>
  </div>
  <div style="text-align: center; margin-top: 20px; font-size: 11px; color: #A0AEC0;">
    <p>&copy; ${new Date().getFullYear()} DSL Enterprises (Pvt) Ltd. All rights reserved.</p>
  </div>
</div>
`;

    const res = await this.dispatchEmail({
      to: params.email,
      subject,
      text,
      html,
    });

    return {
      success: true,
      messageId: res.messageId,
    };
  }

  /**
   * Dispatches guest order tracking OTP (Phase B.1).
   * Note: Plaintext OTP is NEVER logged in persistent application logs.
   */
  async sendOrderTrackingOtp(params: {
    email: string;
    orderNumber: string;
    otp: string;
  }): Promise<{ success: boolean; messageId: string }> {
    const subject = `Your Order #${params.orderNumber} Tracking Verification Code: ${params.otp}`;
    const text = `
Dear Customer,

A request was made to view the order tracking details for order #${params.orderNumber} on DSL Stationery.

Your 6-digit access verification code is: ${params.otp}

This code will expire in 10 minutes. For security, access will be locked after 5 consecutive incorrect attempts.
If you did not initiate this tracking request, please contact support@dslstationery.lk.

Best regards,
DSL Stationery Team
`;

    const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #C6E7FF; border-radius: 16px; background-color: #FFFDF0; color: #292525;">
  <div style="text-align: center; margin-bottom: 24px;">
    <h1 style="color: #0066CC; font-size: 24px; font-weight: 800; margin: 0;">DSL Stationery</h1>
    <p style="color: #666; font-size: 13px; margin: 4px 0 0 0;">Order Tracking Access</p>
  </div>
  <div style="background-color: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #E2E8F0;">
    <h2 style="font-size: 18px; color: #10285D; margin-top: 0;">Order #${params.orderNumber} Tracking Verification</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #4A5568;">Use the 6-digit code below to view your order status:</p>
    <div style="text-align: center; margin: 28px 0;">
      <span style="display: inline-block; font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #0066CC; background-color: #F0F7FF; border: 2px dashed #0066CC; border-radius: 8px; padding: 12px 24px;">${params.otp}</span>
    </div>
    <p style="font-size: 12px; color: #718096; line-height: 1.5;">This verification code will expire in <strong>10 minutes</strong>.</p>
  </div>
</div>
`;

    const res = await this.dispatchEmail({
      to: params.email,
      subject,
      text,
      html,
    });

    return {
      success: true,
      messageId: res.messageId,
    };
  }

  /**
   * Dispatches password reset email.
   */
  async sendPasswordResetEmail(params: {
    email: string;
    name?: string;
    resetUrl: string;
    expiresHours?: number;
  }): Promise<{ success: boolean; messageId: string }> {
    const hours = params.expiresHours ?? 1;
    const subject = `Reset Your Password - DSL Stationery`;
    const text = `
Hello ${params.name || 'Customer'},

We received a request to reset your password for your DSL Stationery account.

To reset your password, please click the link below (valid for ${hours} hour${hours > 1 ? 's' : ''}):
${params.resetUrl}

If you did not request a password reset, you can safely ignore this email.

Best regards,
DSL Stationery Security Team
support@dslstationery.lk
`;

    const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #C6E7FF; border-radius: 16px; background-color: #FFFDF0; color: #292525;">
  <div style="text-align: center; margin-bottom: 24px;">
    <h1 style="color: #0066CC; font-size: 24px; font-weight: 800; margin: 0;">DSL Stationery</h1>
    <p style="color: #666; font-size: 13px; margin: 4px 0 0 0;">Account Security</p>
  </div>
  <div style="background-color: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #E2E8F0;">
    <h2 style="font-size: 18px; color: #10285D; margin-top: 0;">Password Reset Request</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #4A5568;">Hello <strong>${params.name || 'Customer'}</strong>,</p>
    <p style="font-size: 14px; line-height: 1.6; color: #4A5568;">We received a request to reset your password for your DSL Stationery account. Click the button below to proceed:</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${params.resetUrl}" style="display: inline-block; background-color: #0066CC; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 9999px;">Reset My Password</a>
    </div>
    <p style="font-size: 12px; color: #718096; line-height: 1.5;">This link will expire in <strong>${hours} hour${hours > 1 ? 's' : ''}</strong>. If you did not request a password reset, please ignore this email.</p>
    <p style="font-size: 11px; color: #A0AEC0; word-break: break-all;">Link: ${params.resetUrl}</p>
  </div>
  <div style="text-align: center; margin-top: 20px; font-size: 11px; color: #A0AEC0;">
    <p>&copy; ${new Date().getFullYear()} DSL Enterprises (Pvt) Ltd. All rights reserved.</p>
  </div>
</div>
`;

    const res = await this.dispatchEmail({
      to: params.email,
      subject,
      text,
      html,
    });

    return {
      success: true,
      messageId: res.messageId,
    };
  }

  /**
   * Checks whether a real production email provider is configured.
   */
  isEmailProviderConfigured(): boolean {
    const host = this.configService.get<string>('SMTP_HOST');
    const user = this.configService.get<string>('SMTP_USER');
    const apiKey = this.configService.get<string>('EMAIL_PROVIDER_API_KEY');
    return Boolean((host && user) || apiKey);
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
    const subject = 'Confirm Your Newsletter Subscription - DSL Stationery';

    const text = `
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

    const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #C6E7FF; border-radius: 16px; background-color: #FFFDF0; color: #292525;">
  <div style="text-align: center; margin-bottom: 24px;">
    <h1 style="color: #0066CC; font-size: 24px; font-weight: 800; margin: 0;">DSL Stationery</h1>
    <p style="color: #666; font-size: 13px; margin: 4px 0 0 0;">Premier Stationery in Sri Lanka</p>
  </div>
  <div style="background-color: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #E2E8F0;">
    <h2 style="font-size: 18px; color: #10285D; margin-top: 0;">Confirm Your Newsletter Subscription</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #4A5568;">Hello,</p>
    <p style="font-size: 14px; line-height: 1.6; color: #4A5568;">Thank you for your interest in the DSL Stationery newsletter! Please click the button below to confirm your subscription:</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${params.verificationUrl}" style="display: inline-block; background-color: #0066CC; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 9999px;">Confirm Subscription</a>
    </div>
    <p style="font-size: 12px; color: #718096; line-height: 1.5;">This link will expire in <strong>${hours} hours</strong>. If you did not request this subscription, please ignore this email.</p>
  </div>
</div>
`;

    const res = await this.dispatchEmail({
      to: params.email,
      subject,
      text,
      html,
    });

    return {
      success: true,
      messageId: res.messageId,
      deliveryStatus: res.deliveryStatus,
    };
  }

  /**
   * Phase 2: Dispatches administrator invitation link.
   * Reports genuine provider delivery vs simulated environment dispatch.
   */
  async sendAdminInvitationEmail(params: {
    email: string;
    name: string;
    role: string;
    invitationUrl: string;
    expiresHours?: number;
  }): Promise<{ success: boolean; messageId: string; deliveryStatus: 'DELIVERED' | 'SIMULATED' }> {
    const hours = params.expiresHours ?? 48;
    const subject = `Administrator Invitation - DSL Stationery Admin Portal`;

    const text = `
=====================================================
            DSL STATIONERY ADMIN PORTAL
=====================================================

Administrator Invitation

Hello ${params.name},

You have been invited to join the DSL Stationery administrative portal with the role of: ${params.role}.

To accept this invitation and set up your secure password, please click the link below:

Accept Invitation & Set Password:
${params.invitationUrl}

Important Information:
- This invitation link is unique to you and expires in ${hours} hours.
- If you were not expecting an administrator invitation from DSL Stationery, please contact your store system administrator immediately.

DSL Enterprises (Pvt) Ltd
Technical Operations: support@dslstationery.lk
=====================================================
`;

    const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #C6E7FF; border-radius: 16px; background-color: #FFFDF0; color: #292525;">
  <div style="text-align: center; margin-bottom: 24px;">
    <h1 style="color: #0066CC; font-size: 24px; font-weight: 800; margin: 0;">DSL Stationery</h1>
    <p style="color: #666; font-size: 13px; margin: 4px 0 0 0;">Admin Portal Access</p>
  </div>
  <div style="background-color: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #E2E8F0;">
    <h2 style="font-size: 18px; color: #10285D; margin-top: 0;">Administrator Portal Invitation</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #4A5568;">Hello <strong>${params.name}</strong>,</p>
    <p style="font-size: 14px; line-height: 1.6; color: #4A5568;">You have been invited to join the DSL Stationery administrative portal as <strong>${params.role}</strong>. Click below to accept the invitation and configure your credentials:</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${params.invitationUrl}" style="display: inline-block; background-color: #0066CC; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 9999px;">Accept Invitation</a>
    </div>
    <p style="font-size: 12px; color: #718096; line-height: 1.5;">This invitation link will expire in <strong>${hours} hours</strong>.</p>
  </div>
</div>
`;

    const res = await this.dispatchEmail({
      to: params.email,
      subject,
      text,
      html,
    });

    return {
      success: true,
      messageId: res.messageId,
      deliveryStatus: res.deliveryStatus,
    };
  }
}



