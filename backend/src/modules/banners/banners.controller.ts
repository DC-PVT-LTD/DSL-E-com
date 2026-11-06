import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
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
  @ApiResponse({ status: 200, description: 'List of active homepage banners' })
  async getHomepageBanners() {
    const banners = await this.bannersService.getHomepageBanners();
    return createApiResponse(banners, 'Homepage banners retrieved successfully');
  }
}

