import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CustomerUser, SavedList } from '@/types/user';
import { ShippingAddress } from '@/types/order';
import { INITIAL_CUSTOMERS } from '@/mocks/customers';

interface UserState {
  currentUser: CustomerUser | null;
  isAdminLoggedIn: boolean;
  adminEmail: string | null;

  // Customer actions
  loginCustomer: (email: string) => boolean;
  logoutCustomer: () => void;
  toggleWishlist: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;
  addAddress: (address: ShippingAddress & { isDefault?: boolean }) => void;
  removeAddress: (addressId: string) => void;
  createSavedList: (title: string, productIds: string[], description?: string) => void;
  removeSavedList: (listId: string) => void;

  // Admin demo auth
  loginAdmin: (email: string) => void;
  logoutAdmin: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      currentUser: INITIAL_CUSTOMERS[0], // Default logged-in demo customer for rich out-of-the-box demo
      isAdminLoggedIn: true, // Default active demo admin session
      adminEmail: 'admin@dslstationery.lk',

      loginCustomer: (email: string) => {
        const found = INITIAL_CUSTOMERS.find((c) => c.email.toLowerCase() === email.toLowerCase());
        if (found) {
          set({ currentUser: found });
          return true;
        }
        // Create demo account for any new email
        const newCustomer: CustomerUser = {
          id: `cust-${Date.now()}`,
          name: email.split('@')[0],
          email,
          phone: '+94 77 000 0000',
          addresses: [],
          wishlistProductIds: [],
          savedLists: [],
          isDemoAccount: true,
        };
        set({ currentUser: newCustomer });
        return true;
      },

      logoutCustomer: () => {
        set({ currentUser: null });
      },

      toggleWishlist: (productId: string) => {
        const user = get().currentUser;
        if (!user) return;

        const exists = user.wishlistProductIds.includes(productId);
        const updatedWishlist = exists
          ? user.wishlistProductIds.filter((id) => id !== productId)
          : [...user.wishlistProductIds, productId];

        set({
          currentUser: {
            ...user,
            wishlistProductIds: updatedWishlist,
          },
        });
      },

      isInWishlist: (productId: string) => {
        const user = get().currentUser;
        return user ? user.wishlistProductIds.includes(productId) : false;
      },

      addAddress: (address) => {
        const user = get().currentUser;
        if (!user) return;

        const newAddr = {
          ...address,
          id: `addr-${Date.now()}`,
        };

        const currentAddresses = address.isDefault
          ? user.addresses.map((a) => ({ ...a, isDefault: false }))
          : user.addresses;

        set({
          currentUser: {
            ...user,
            addresses: [...currentAddresses, newAddr],
          },
        });
      },

      removeAddress: (addressId) => {
        const user = get().currentUser;
        if (!user) return;
        set({
          currentUser: {
            ...user,
            addresses: user.addresses.filter((a) => a.id !== addressId),
          },
        });
      },

      createSavedList: (title, productIds, description) => {
        const user = get().currentUser;
        if (!user) return;

        const newList: SavedList = {
          id: `list-${Date.now()}`,
          title,
          description,
          itemProductIds: productIds,
          createdAt: new Date().toISOString(),
        };

        set({
          currentUser: {
            ...user,
            savedLists: [newList, ...user.savedLists],
          },
        });
      },

      removeSavedList: (listId) => {
        const user = get().currentUser;
        if (!user) return;
        set({
          currentUser: {
            ...user,
            savedLists: user.savedLists.filter((l) => l.id !== listId),
          },
        });
      },

      loginAdmin: (email) => {
        set({ isAdminLoggedIn: true, adminEmail: email });
      },

      logoutAdmin: () => {
        set({ isAdminLoggedIn: false, adminEmail: null });
      },
    }),
    {
      name: 'dsl_user_v1',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
