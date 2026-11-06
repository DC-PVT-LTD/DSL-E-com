import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { NewsletterService } from './newsletter.service';
import {
  subscribeNewsletterSchema,
  SubscribeNewsletterDto,
  verifyNewsletterSchema,
  VerifyNewsletterDto,
  resendVerificationSchema,
  ResendVerificationDto,
  unsubscribeSchema,
  UnsubscribeDto,
} from './dto/newsletter.dto';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { createApiResponse } from '../../common/interfaces/api-response.interface';

@ApiTags('Newsletter')
@Controller('newsletter')
export class NewsletterController {
  constructor(
    @Inject(NewsletterService)
    private readonly newsletterService: NewsletterService
  ) {}

  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Subscribe to newsletter with explicit marketing consent' })
  @ApiResponse({ status: 200, description: 'Subscription request received' })
  @ApiResponse({ status: 400, description: 'Invalid email or missing affirmative consent' })
  async subscribe(
    @Body(createZodPipe(subscribeNewsletterSchema)) dto: SubscribeNewsletterDto
  ) {
    const result = await this.newsletterService.subscribe(dto);
    return createApiResponse(null, result.message);
  }

  @Get('verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Verify email address with double opt-in token' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verify(
    @Query(createZodPipe(verifyNewsletterSchema)) query: VerifyNewsletterDto
  ) {
    const result = await this.newsletterService.verify(query.token);
    return createApiResponse({ verified: true }, result.message);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Resend double opt-in verification link' })
  @ApiResponse({ status: 200, description: 'Verification link resent if eligible' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async resendVerification(
    @Body(createZodPipe(resendVerificationSchema)) dto: ResendVerificationDto
  ) {
    const result = await this.newsletterService.resendVerification(dto);
    return createApiResponse(null, result.message);
  }

  @Get('unsubscribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check unsubscribe link details' })
  @ApiResponse({ status: 200, description: 'Subscriber status retrieved' })
  @ApiResponse({ status: 404, description: 'Invalid unsubscribe link' })
  async getUnsubscribeInfo(
    @Query(createZodPipe(unsubscribeSchema)) query: UnsubscribeDto
  ) {
    const info = await this.newsletterService.getUnsubscribeInfo(query.token);
    return createApiResponse(info, 'Unsubscribe info retrieved');
  }

  @Post('unsubscribe')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Unsubscribe from newsletter' })
  @ApiResponse({ status: 200, description: 'Successfully unsubscribed' })
  @ApiResponse({ status: 404, description: 'Invalid unsubscribe token' })
  async unsubscribe(
    @Body(createZodPipe(unsubscribeSchema)) dto: UnsubscribeDto
  ) {
    const result = await this.newsletterService.unsubscribe(dto.token);
    return createApiResponse({ unsubscribed: true }, result.message);
  }
}

