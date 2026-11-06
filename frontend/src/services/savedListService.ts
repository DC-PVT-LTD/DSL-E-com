import { apiClient } from '@/lib/api/apiClient';
import {
  SavedListSummary,
  SavedListDetail,
  SavedListItem,
  ListAvailabilityReport,
} from '@/types/savedList';

export const savedListService = {
  /**
   * Get all saved lists for current customer.
   */
  async getLists(): Promise<SavedListSummary[]> {
    return apiClient.get<SavedListSummary[]>('/saved-lists');
  },

  /**
   * Create a new saved list.
   */
  async createList(name: string): Promise<SavedListSummary> {
    return apiClient.post<SavedListSummary>('/saved-lists', { name });
  },

  /**
   * Retrieve list details and its items.
   */
  async getListById(id: string): Promise<SavedListDetail> {
    return apiClient.get<SavedListDetail>(`/saved-lists/${id}`);
  },

  /**
   * Rename an existing list.
   */
  async renameList(id: string, name: string): Promise<{ id: string; name: string }> {
    return apiClient.patch<{ id: string; name: string }>(`/saved-lists/${id}`, { name });
  },

  /**
   * Delete a saved list.
   */
  async deleteList(id: string): Promise<{ success: boolean; listId: string }> {
    return apiClient.delete<{ success: boolean; listId: string }>(`/saved-lists/${id}`);
  },

  /**
   * Add a product to a saved list with quantity.
   */
  async addItem(listId: string, productId: string, quantity: number = 1): Promise<SavedListItem> {
    return apiClient.post<SavedListItem>(`/saved-lists/${listId}/items`, {
      productId,
      quantity,
    });
  },

  /**
   * Update quantity of an item in a list.
   */
  async updateItemQuantity(
    listId: string,
    itemId: string,
    quantity: number
  ): Promise<SavedListItem> {
    return apiClient.patch<SavedListItem>(`/saved-lists/${listId}/items/${itemId}`, {
      quantity,
    });
  },

  /**
   * Remove an item from a list.
   */
  async removeItem(
    listId: string,
    itemId: string
  ): Promise<{ success: boolean; itemId: string }> {
    return apiClient.delete<{ success: boolean; itemId: string }>(
      `/saved-lists/${listId}/items/${itemId}`
    );
  },

  /**
   * Check live availability and stock readiness for cart transfer.
   */
  async checkAvailability(listId: string): Promise<ListAvailabilityReport> {
    return apiClient.get<ListAvailabilityReport>(`/saved-lists/${listId}/availability`);
  },
};

