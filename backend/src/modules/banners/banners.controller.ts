import { Controller, Get, Query, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { BannersService } from './banners.service';
import { createApiResponse } from '../../common/interfaces/api-response.interface';

@ApiTags('Banners (Public)')
@Controller('banners')
export class BannersController {
  constructor(
    @Inject(BannersService)
    private readonly bannersService: BannersService
  ) {}

  @Get('homepage')
  @ApiOperation({
    summary: 'Get active homepage banners for store visitors',
    description: 'Returns all active published/scheduled banners ordered by sort order with effective status.',
  })
  @ApiQuery({ name: 'placement', required: false, description: 'Optional placement slot (e.g. HERO, MID_PAGE_PROMO)' })
  @ApiResponse({ status: 200, description: 'List of active homepage banners' })
  async getHomepageBanners(@Query('placement') placement?: string) {
    const banners = await this.bannersService.getHomepageBanners(placement);
    return createApiResponse(banners, 'Homepage banners retrieved successfully');
  }
}

