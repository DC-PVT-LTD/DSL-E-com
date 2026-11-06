import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RecommendationsService } from './recommendations.service';
import {
  getRecommendationsSchema,
  GetRecommendationsDto,
} from './dto/get-recommendations.dto';
import {
  validateBasketSchema,
  ValidateBasketDto,
} from './dto/validate-basket.dto';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { createApiResponse } from '../../common/interfaces/api-response.interface';

@ApiTags('Find My Stationery Recommendations')
@Controller('recommendations')
export class RecommendationsController {
  constructor(
    @Inject(RecommendationsService)
    private readonly recommendationsService: RecommendationsService
  ) {}

  @Get('config')
  @ApiOperation({ summary: 'Get configuration for recommendation wizard' })
  @ApiResponse({ status: 200, description: 'Recommendation configuration options' })
  getConfig() {
    const config = this.recommendationsService.getConfig();
    return createApiResponse(config);
  }

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate stationery recommendations based on criteria' })
  @ApiResponse({ status: 200, description: 'Personalized recommendation basket' })
  async generate(
    @Body(createZodPipe(getRecommendationsSchema)) dto: GetRecommendationsDto
  ) {
    const recommendations = await this.recommendationsService.getRecommendations(dto);
    return createApiResponse(recommendations);
  }

  @Post('validate-basket')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Server-authoritative validation of recommendation basket before cart addition' })
  @ApiResponse({ status: 200, description: 'Validated basket prices, quantities and availability' })
  async validateBasket(
    @Body(createZodPipe(validateBasketSchema)) dto: ValidateBasketDto
  ) {
    const result = await this.recommendationsService.validateBasket(dto);
    return createApiResponse(result);
  }

  @Get('substitutes/:productId')
  @ApiOperation({ summary: 'Get catalogue substitutes for a recommended product' })
  @ApiResponse({ status: 200, description: 'List of compatible substitute products' })
  async getSubstitutes(@Param('productId') productId: string) {
    const substitutes = await this.recommendationsService.getSubstitutes(productId);
    return createApiResponse(substitutes);
  }
}

