import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { SavedListsService } from './saved-lists.service';
import {
  CreateSavedListDto,
  UpdateSavedListDto,
  AddSavedListItemDto,
  UpdateSavedListItemDto,
  SavedListSummaryResponseDto,
  SavedListDetailResponseDto,
  SavedListItemResponseDto,
  ListAvailabilityResponseDto,
  createSavedListSchema,
  updateSavedListSchema,
  addSavedListItemSchema,
  updateSavedListItemSchema,
} from './dto/saved-list.dto';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';

@ApiTags('Saved Stationery Lists')
@ApiBearerAuth()
@Controller('saved-lists')
@UseGuards(JwtAuthGuard)
export class SavedListsController {
  constructor(private readonly savedListsService: SavedListsService) {}

  /**
   * GET /api/v1/saved-lists
   * Get all saved lists for current customer.
   */
  @Get()
  @ApiOperation({ summary: 'Get all saved stationery lists' })
  @ApiResponse({ status: 200, description: 'List of saved stationery lists' })
  async getLists(@CurrentUser() user: AuthenticatedUser): Promise<SavedListSummaryResponseDto[]> {
    return this.savedListsService.getLists(user.id);
  }

  /**
   * POST /api/v1/saved-lists
   * Create a new saved stationery list.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new saved stationery list' })
  @ApiResponse({ status: 201, description: 'Saved list created' })
  async createList(
    @CurrentUser() user: AuthenticatedUser,
    @Body(createZodPipe(createSavedListSchema)) dto: CreateSavedListDto
  ): Promise<SavedListSummaryResponseDto> {
    return this.savedListsService.createList(user.id, dto.name);
  }

  /**
   * GET /api/v1/saved-lists/:id
   * Get list details and product items.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get saved stationery list details' })
  @ApiResponse({ status: 200, description: 'Saved list with items' })
  async getListById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ): Promise<SavedListDetailResponseDto> {
    return this.savedListsService.getListById(user.id, id);
  }

  /**
   * PATCH /api/v1/saved-lists/:id
   * Rename a saved list.
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Rename a saved stationery list' })
  @ApiResponse({ status: 200, description: 'Saved list renamed' })
  async renameList(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(createZodPipe(updateSavedListSchema)) dto: UpdateSavedListDto
  ): Promise<{ id: string; name: string }> {
    return this.savedListsService.renameList(user.id, id, dto.name);
  }

  /**
   * DELETE /api/v1/saved-lists/:id
   * Delete a saved list.
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a saved stationery list' })
  @ApiResponse({ status: 200, description: 'Saved list deleted' })
  async deleteList(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ): Promise<{ success: boolean; listId: string }> {
    return this.savedListsService.deleteList(user.id, id);
  }

  /**
   * GET /api/v1/saved-lists/:id/availability
   * Check stock availability of all items in a list.
   */
  @Get(':id/availability')
  @ApiOperation({ summary: 'Check live stock availability of list items' })
  @ApiResponse({ status: 200, description: 'Availability report for list items' })
  async checkAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ): Promise<ListAvailabilityResponseDto> {
    return this.savedListsService.checkAvailability(user.id, id);
  }

  /**
   * POST /api/v1/saved-lists/:id/items
   * Add a product to a saved list.
   */
  @Post(':id/items')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add product to a saved list' })
  @ApiResponse({ status: 200, description: 'Product added to saved list' })
  async addItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(createZodPipe(addSavedListItemSchema)) dto: AddSavedListItemDto
  ): Promise<SavedListItemResponseDto> {
    return this.savedListsService.addItem(user.id, id, dto.productId, dto.quantity);
  }

  /**
   * PATCH /api/v1/saved-lists/:id/items/:itemId
   * Update quantity of a list item.
   */
  @Patch(':id/items/:itemId')
  @ApiOperation({ summary: 'Update item quantity in saved list' })
  @ApiResponse({ status: 200, description: 'Item quantity updated' })
  async updateItemQuantity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body(createZodPipe(updateSavedListItemSchema)) dto: UpdateSavedListItemDto
  ): Promise<SavedListItemResponseDto> {
    return this.savedListsService.updateItemQuantity(user.id, id, itemId, dto.quantity);
  }

  /**
   * DELETE /api/v1/saved-lists/:id/items/:itemId
   * Remove a product from a saved list.
   */
  @Delete(':id/items/:itemId')
  @ApiOperation({ summary: 'Remove item from saved list' })
  @ApiResponse({ status: 200, description: 'Item removed from saved list' })
  async removeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string
  ): Promise<{ success: boolean; itemId: string }> {
    return this.savedListsService.removeItem(user.id, id, itemId);
  }
}

