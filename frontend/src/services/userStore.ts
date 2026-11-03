import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CustomerUser, SavedList } from '@/types/user';
import { ShippingAddress } from '@/types/order';
import { apiClient } from '@/lib/api/apiClient';

interface UserState {
  currentUser: CustomerUser | null;
  isAdminLoggedIn: boolean;
  adminEmail: string | null;
  isLoading: boolean;

  // Real backend auth actions
  loginCustomer: (email: string, password?: string) => Promise<boolean>;
  registerCustomer: (name: string, email: string, password: string, phone?: string) => Promise<boolean>;
  logoutCustomer: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;

  // Customer account preferences
  toggleWishlist: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;
  addAddress: (address: ShippingAddress & { isDefault?: boolean }) => Promise<void>;
  removeAddress: (addressId: string) => Promise<void>;
  createSavedList: (title: string, productIds: string[], description?: string) => void;
  removeSavedList: (listId: string) => void;

  // Admin auth
  loginAdmin: (email: string, password?: string) => Promise<boolean>;
  logoutAdmin: () => Promise<void>;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      isAdminLoggedIn: false,
      adminEmail: null,
      isLoading: false,

      fetchCurrentUser: async () => {
        try {
          const res = await apiClient.get<{ success: boolean; data: any }>('/auth/me');
          if (res?.data) {
            const u = res.data;
            const current = get().currentUser;
            set({
              currentUser: {
                id: u.id,
                name: u.name,
                email: u.email,
                phone: u.phone || '',
                role: u.role,
                addresses: current?.addresses || [],
                wishlistProductIds: current?.wishlistProductIds || [],
                savedLists: current?.savedLists || [],
              },
              isAdminLoggedIn: u.role === 'ADMIN' || u.role === 'MANAGER',
              adminEmail: u.role === 'ADMIN' || u.role === 'MANAGER' ? u.email : null,
            });
          }
        } catch {
          // Token expired or unauthenticated
        }
      },

      loginCustomer: async (email: string, password = 'Password123!') => {
        set({ isLoading: true });
        try {
          const res = await apiClient.post<{ success: boolean; data: any }>('/auth/login', {
            email,
            password,
          });

          if (res?.data) {
            const u = res.data;
            const current = get().currentUser;
            set({
              currentUser: {
                id: u.id,
                name: u.name,
                email: u.email,
                phone: u.phone || '',
                role: u.role,
                addresses: current?.addresses || [],
                wishlistProductIds: current?.wishlistProductIds || [],
                savedLists: current?.savedLists || [],
              },
              isAdminLoggedIn: u.role === 'ADMIN' || u.role === 'MANAGER',
              adminEmail: u.role === 'ADMIN' || u.role === 'MANAGER' ? u.email : null,
              isLoading: false,
            });
            return true;
          }
          set({ isLoading: false });
          return false;
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      registerCustomer: async (name: string, email: string, password: string, phone?: string) => {
        set({ isLoading: true });
        try {
          const res = await apiClient.post<{ success: boolean; data: any }>('/auth/register', {
            name,
            email,
            password,
            phone,
          });

          if (res?.data) {
            const u = res.data;
            set({
              currentUser: {
                id: u.id,
                name: u.name,
                email: u.email,
                phone: u.phone || '',
                role: u.role,
                addresses: [],
                wishlistProductIds: [],
                savedLists: [],
              },
              isLoading: false,
            });
            return true;
          }
          set({ isLoading: false });
          return false;
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      logoutCustomer: async () => {
        try {
          await apiClient.post('/auth/logout');
        } catch {
          // Continue local cleanup even if network fails
        }
        set({ currentUser: null, isAdminLoggedIn: false, adminEmail: null });
      },

      loginAdmin: async (email: string, password = 'AdminPassword123!') => {
        set({ isLoading: true });
        try {
          const res = await apiClient.post<{ success: boolean; data: any }>('/auth/login', {
            email,
            password,
          });

          if (res?.data) {
            const u = res.data;
            if (u.role !== 'ADMIN' && u.role !== 'MANAGER') {
              throw new Error('Access denied: administrative role required');
            }
            set({
              isAdminLoggedIn: true,
              adminEmail: u.email,
              currentUser: {
                id: u.id,
                name: u.name,
                email: u.email,
                role: u.role,
                addresses: [],
                wishlistProductIds: [],
                savedLists: [],
              },
              isLoading: false,
            });
            return true;
          }
          set({ isLoading: false });
          return false;
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      logoutAdmin: async () => {
        try {
          await apiClient.post('/auth/logout');
        } catch {}
        set({ isAdminLoggedIn: false, adminEmail: null });
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

      addAddress: async (address) => {
        const user = get().currentUser;
        if (!user) return;

        try {
          const res = await apiClient.post<{ success: boolean; data: any }>('/auth/me/addresses', {
            fullName: address.fullName,
            phone: address.phone,
            email: address.email,
            addressLine1: address.addressLine1,
            addressLine2: address.addressLine2,
            city: address.city,
            district: address.district,
            postalCode: address.postalCode,
            isDefault: address.isDefault || false,
          });

          const created = res.data;
          const currentAddresses = address.isDefault
            ? user.addresses.map((a) => ({ ...a, isDefault: false }))
            : user.addresses;

          set({
            currentUser: {
              ...user,
              addresses: [...currentAddresses, created],
            },
          });
        } catch {
          // Fallback to local storage if API call fails
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
        }
      },

      removeAddress: async (addressId) => {
        const user = get().currentUser;
        if (!user) return;

        try {
          await apiClient.delete(`/auth/me/addresses/${addressId}`);
        } catch {}

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
    }),
    {
      name: 'dsl_auth_v2',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
