import { create } from 'zustand';
import {
  SavedListSummary,
  SavedListDetail,
  ListAvailabilityReport,
} from '@/types/savedList';
import { savedListService } from './savedListService';
import { useUserStore } from './userStore';

interface SavedListState {
  lists: SavedListSummary[];
  activeList: SavedListDetail | null;
  isLoading: boolean;
  error: string | null;

  fetchLists: () => Promise<void>;
  createList: (name: string) => Promise<SavedListSummary | null>;
  fetchListById: (id: string) => Promise<SavedListDetail | null>;
  renameList: (id: string, name: string) => Promise<boolean>;
  deleteList: (id: string) => Promise<boolean>;
  addItemToList: (listId: string, productId: string, quantity?: number) => Promise<boolean>;
  updateItemQuantity: (listId: string, itemId: string, quantity: number) => Promise<boolean>;
  removeItemFromList: (listId: string, itemId: string) => Promise<boolean>;
  checkAvailability: (listId: string) => Promise<ListAvailabilityReport | null>;
  clearActiveList: () => void;
}

export const useSavedListStore = create<SavedListState>((set, get) => ({
  lists: [],
  activeList: null,
  isLoading: false,
  error: null,

  fetchLists: async () => {
    const currentUser = useUserStore.getState().currentUser;
    if (!currentUser) {
      set({ lists: [], isLoading: false, error: null });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const data = await savedListService.getLists();
      set({ lists: Array.isArray(data) ? data : [], isLoading: false, error: null });
    } catch (err: any) {
      set({
        isLoading: false,
        error: err?.status === 401 ? null : err?.message || 'Failed to load saved lists',
      });
    }
  },

  createList: async (name: string) => {
    set({ isLoading: true, error: null });
    try {
      const newList = await savedListService.createList(name);
      set((state) => ({
        lists: [newList, ...state.lists],
        isLoading: false,
        error: null,
      }));
      return newList;
    } catch (err: any) {
      set({ isLoading: false, error: err?.message || 'Failed to create list' });
      return null;
    }
  },

  fetchListById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const detail = await savedListService.getListById(id);
      set({ activeList: detail, isLoading: false, error: null });
      return detail;
    } catch (err: any) {
      set({
        activeList: null,
        isLoading: false,
        error: err?.message || 'Failed to load list details',
      });
      return null;
    }
  },

  renameList: async (id: string, name: string) => {
    try {
      const updated = await savedListService.renameList(id, name);
      set((state) => ({
        lists: state.lists.map((l) => (l.id === id ? { ...l, name: updated.name } : l)),
        activeList:
          state.activeList?.id === id ? { ...state.activeList, name: updated.name } : state.activeList,
      }));
      return true;
    } catch (err: any) {
      set({ error: err?.message || 'Failed to rename list' });
      return false;
    }
  },

  deleteList: async (id: string) => {
    try {
      await savedListService.deleteList(id);
      set((state) => ({
        lists: state.lists.filter((l) => l.id !== id),
        activeList: state.activeList?.id === id ? null : state.activeList,
      }));
      return true;
    } catch (err: any) {
      set({ error: err?.message || 'Failed to delete list' });
      return false;
    }
  },

  addItemToList: async (listId: string, productId: string, quantity: number = 1) => {
    try {
      const savedItem = await savedListService.addItem(listId, productId, quantity);
      const { activeList } = get();

      // If activeList is currently open and is this list, update it
      if (activeList && activeList.id === listId) {
        const existingIdx = activeList.items.findIndex((i) => i.productId === productId);
        let updatedItems = [...activeList.items];

        if (existingIdx >= 0) {
          updatedItems[existingIdx] = savedItem;
        } else {
          updatedItems = [savedItem, ...updatedItems];
        }

        const newTotal = updatedItems.reduce(
          (sum, i) => (i.product.isActive ? sum + i.product.priceCents * i.quantity : sum),
          0
        );

        set({
          activeList: {
            ...activeList,
            items: updatedItems,
            itemCount: updatedItems.length,
            estimatedTotalCents: newTotal,
          },
        });
      }

      // Refresh summary lists
      get().fetchLists();
      return true;
    } catch (err: any) {
      set({ error: err?.message || 'Failed to add item to list' });
      return false;
    }
  },

  updateItemQuantity: async (listId: string, itemId: string, quantity: number) => {
    try {
      const updatedItem = await savedListService.updateItemQuantity(listId, itemId, quantity);
      const { activeList } = get();

      if (activeList && activeList.id === listId) {
        const updatedItems = activeList.items.map((i) => (i.id === itemId ? updatedItem : i));
        const newTotal = updatedItems.reduce(
          (sum, i) => (i.product.isActive ? sum + i.product.priceCents * i.quantity : sum),
          0
        );

        set({
          activeList: {
            ...activeList,
            items: updatedItems,
            estimatedTotalCents: newTotal,
          },
        });
      }

      get().fetchLists();
      return true;
    } catch (err: any) {
      set({ error: err?.message || 'Failed to update quantity' });
      return false;
    }
  },

  removeItemFromList: async (listId: string, itemId: string) => {
    try {
      await savedListService.removeItem(listId, itemId);
      const { activeList } = get();

      if (activeList && activeList.id === listId) {
        const updatedItems = activeList.items.filter((i) => i.id !== itemId);
        const newTotal = updatedItems.reduce(
          (sum, i) => (i.product.isActive ? sum + i.product.priceCents * i.quantity : sum),
          0
        );

        set({
          activeList: {
            ...activeList,
            items: updatedItems,
            itemCount: updatedItems.length,
            estimatedTotalCents: newTotal,
          },
        });
      }

      get().fetchLists();
      return true;
    } catch (err: any) {
      set({ error: err?.message || 'Failed to remove item' });
      return false;
    }
  },

  checkAvailability: async (listId: string) => {
    try {
      return await savedListService.checkAvailability(listId);
    } catch (err: any) {
      set({ error: err?.message || 'Failed to check list availability' });
      return null;
    }
  },

  clearActiveList: () => {
    set({ activeList: null, error: null });
  },
}));

