import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSavedListStore } from '../savedListStore';
import { savedListService } from '../savedListService';
import { useUserStore } from '../userStore';

describe('useSavedListStore', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useSavedListStore.setState({
      lists: [],
      activeList: null,
      isLoading: false,
      error: null,
    });
    useUserStore.setState({
      currentUser: {
        id: 'cust-test-1',
        name: 'Test Customer',
        email: 'customer@dslstationery.lk',
        phone: '0771234567',
        role: 'CUSTOMER',
        addresses: [],
        wishlistProductIds: [],
        savedLists: [],
      },
    });
  });

  describe('fetchLists', () => {
    it('loads customer saved lists from service', async () => {
      const mockLists = [
        {
          id: 'list-1',
          name: 'Grade 5 Supplies',
          itemCount: 2,
          estimatedTotalCents: 45000,
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-02T00:00:00Z',
          previewImages: ['/img/pen.png'],
        },
      ];

      vi.spyOn(savedListService, 'getLists').mockResolvedValue(mockLists);

      await useSavedListStore.getState().fetchLists();

      expect(useSavedListStore.getState().lists).toHaveLength(1);
      expect(useSavedListStore.getState().lists[0].name).toBe('Grade 5 Supplies');
      expect(useSavedListStore.getState().lists[0].estimatedTotalCents).toBe(45000);
    });
  });

  describe('createList', () => {
    it('creates a new list and prepends it to store lists', async () => {
      const newList = {
        id: 'list-2',
        name: 'Term 1 Books',
        itemCount: 0,
        estimatedTotalCents: 0,
        createdAt: '2026-11-05T00:00:00Z',
        updatedAt: '2026-11-05T00:00:00Z',
        previewImages: [],
      };

      vi.spyOn(savedListService, 'createList').mockResolvedValue(newList);

      const res = await useSavedListStore.getState().createList('Term 1 Books');

      expect(res).toEqual(newList);
      expect(useSavedListStore.getState().lists).toHaveLength(1);
      expect(useSavedListStore.getState().lists[0].id).toBe('list-2');
    });
  });

  describe('fetchListById', () => {
    it('loads active list detail', async () => {
      const detail = {
        id: 'list-1',
        name: 'Grade 5 Supplies',
        itemCount: 1,
        estimatedTotalCents: 15000,
        createdAt: '2026-11-01T00:00:00Z',
        updatedAt: '2026-11-02T00:00:00Z',
        items: [
          {
            id: 'item-1',
            savedListId: 'list-1',
            productId: 'prod-1',
            quantity: 3,
            createdAt: '2026-11-01T00:00:00Z',
            updatedAt: '2026-11-02T00:00:00Z',
            product: {
              id: 'prod-1',
              name: 'Exercise Book',
              slug: 'exercise-book',
              sku: 'DSL-EB',
              priceCents: 5000,
              stockQuantity: 40,
              isActive: true,
              images: ['/img/book.png'],
            },
          },
        ],
      };

      vi.spyOn(savedListService, 'getListById').mockResolvedValue(detail);

      const res = await useSavedListStore.getState().fetchListById('list-1');

      expect(res).toEqual(detail);
      expect(useSavedListStore.getState().activeList?.id).toBe('list-1');
      expect(useSavedListStore.getState().activeList?.items).toHaveLength(1);
    });
  });

  describe('renameList', () => {
    it('updates list name in lists and activeList', async () => {
      useSavedListStore.setState({
        lists: [
          {
            id: 'list-1',
            name: 'Old Name',
            itemCount: 0,
            estimatedTotalCents: 0,
            createdAt: '',
            updatedAt: '',
            previewImages: [],
          },
        ],
        activeList: {
          id: 'list-1',
          name: 'Old Name',
          itemCount: 0,
          estimatedTotalCents: 0,
          createdAt: '',
          updatedAt: '',
          items: [],
        },
      });

      vi.spyOn(savedListService, 'renameList').mockResolvedValue({ id: 'list-1', name: 'New Name' });

      const ok = await useSavedListStore.getState().renameList('list-1', 'New Name');

      expect(ok).toBe(true);
      expect(useSavedListStore.getState().lists[0].name).toBe('New Name');
      expect(useSavedListStore.getState().activeList?.name).toBe('New Name');
    });
  });

  describe('deleteList', () => {
    it('removes list from store and clears activeList if matching', async () => {
      useSavedListStore.setState({
        lists: [
          {
            id: 'list-1',
            name: 'List 1',
            itemCount: 0,
            estimatedTotalCents: 0,
            createdAt: '',
            updatedAt: '',
            previewImages: [],
          },
        ],
        activeList: {
          id: 'list-1',
          name: 'List 1',
          itemCount: 0,
          estimatedTotalCents: 0,
          createdAt: '',
          updatedAt: '',
          items: [],
        },
      });

      vi.spyOn(savedListService, 'deleteList').mockResolvedValue({ success: true, listId: 'list-1' });

      const ok = await useSavedListStore.getState().deleteList('list-1');

      expect(ok).toBe(true);
      expect(useSavedListStore.getState().lists).toHaveLength(0);
      expect(useSavedListStore.getState().activeList).toBeNull();
    });
  });

  describe('addItemToList & updateItemQuantity & removeItemFromList', () => {
    it('adds, updates, and removes item while recalculating total', async () => {
      useSavedListStore.setState({
        activeList: {
          id: 'list-1',
          name: 'Test List',
          itemCount: 0,
          estimatedTotalCents: 0,
          createdAt: '',
          updatedAt: '',
          items: [],
        },
      });

      const mockSavedItem = {
        id: 'item-10',
        savedListId: 'list-1',
        productId: 'prod-pen',
        quantity: 2,
        createdAt: '',
        updatedAt: '',
        product: {
          id: 'prod-pen',
          name: 'Pen',
          slug: 'pen',
          sku: 'PEN-1',
          priceCents: 2000,
          stockQuantity: 10,
          isActive: true,
          images: [],
        },
      };

      vi.spyOn(savedListService, 'addItem').mockResolvedValue(mockSavedItem);
      vi.spyOn(savedListService, 'getLists').mockResolvedValue([]);

      await useSavedListStore.getState().addItemToList('list-1', 'prod-pen', 2);

      expect(useSavedListStore.getState().activeList?.items).toHaveLength(1);
      expect(useSavedListStore.getState().activeList?.estimatedTotalCents).toBe(4000);

      // Update quantity
      const updatedItem = { ...mockSavedItem, quantity: 5 };
      vi.spyOn(savedListService, 'updateItemQuantity').mockResolvedValue(updatedItem);

      await useSavedListStore.getState().updateItemQuantity('list-1', 'item-10', 5);
      expect(useSavedListStore.getState().activeList?.items[0].quantity).toBe(5);
      expect(useSavedListStore.getState().activeList?.estimatedTotalCents).toBe(10000);

      // Remove item
      vi.spyOn(savedListService, 'removeItem').mockResolvedValue({ success: true, itemId: 'item-10' });

      await useSavedListStore.getState().removeItemFromList('list-1', 'item-10');
      expect(useSavedListStore.getState().activeList?.items).toHaveLength(0);
      expect(useSavedListStore.getState().activeList?.estimatedTotalCents).toBe(0);
    });
  });

  describe('checkAvailability', () => {
    it('delegates availability check to service', async () => {
      const mockReport = {
        listId: 'list-1',
        listName: 'School List',
        totalItems: 1,
        availableCount: 1,
        outOfStockCount: 0,
        partialCount: 0,
        canAddAny: true,
        items: [
          {
            itemId: 'item-1',
            productId: 'prod-1',
            productName: 'Pen',
            requestedQuantity: 2,
            availableStock: 10,
            isActive: true,
            isAvailable: true,
            isPartial: false,
            priceCents: 100,
            lineTotalCents: 200,
          },
        ],
      };

      vi.spyOn(savedListService, 'checkAvailability').mockResolvedValue(mockReport);

      const report = await useSavedListStore.getState().checkAvailability('list-1');

      expect(report).toEqual(mockReport);
      expect(report?.canAddAny).toBe(true);
    });
  });
});

