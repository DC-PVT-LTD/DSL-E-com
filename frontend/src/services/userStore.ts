import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CustomerUser, SavedList } from '@/types/user';
import { ShippingAddress } from '@/types/order';
import { apiClient } from '@/lib/api/apiClient';
import { useCartStore } from './cartStore';
import { useWishlistStore } from './wishlistStore';

interface UserState {
  currentUser: CustomerUser | null;
  isAdminLoggedIn: boolean;
  adminEmail: string | null;
  isLoading: boolean;

  // Real backend auth actions
  loginCustomer: (email: string, password?: string) => Promise<boolean>;
  registerCustomer: (
    name: string,
    email: string,
    password: string,
    phone?: string,
    orderId?: string
  ) => Promise<{ success: boolean; requiresVerification?: boolean; email?: string; message?: string }>;
  verifyEmail: (email: string, otp: string) => Promise<{ success: boolean; message: string; data?: any }>;
  resendVerificationOtp: (email: string) => Promise<{ success: boolean; message: string }>;
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
            const addrRes = await apiClient
              .get<{ success: boolean; data: any[] }>('/auth/me/addresses')
              .catch(() => null);
            const savedAddresses = Array.isArray(addrRes?.data)
              ? addrRes.data
              : current?.addresses || [];

            set({
              currentUser: {
                id: u.id,
                name: u.name,
                email: u.email,
                phone: u.phone || '',
                role: u.role,
                addresses: savedAddresses,
                wishlistProductIds: current?.wishlistProductIds || [],
                savedLists: current?.savedLists || [],
              },
              isAdminLoggedIn: u.role === 'ADMIN' || u.role === 'MANAGER',
              adminEmail: u.role === 'ADMIN' || u.role === 'MANAGER' ? u.email : null,
            });
            // Synchronize customer cart and wishlist from authoritative backend
            useCartStore.getState().fetchCart();
            useWishlistStore.getState().fetchWishlist();
          }
        } catch {
          // Session expired or unauthenticated - synchronize state so UI reflects actual auth
          useWishlistStore.getState().clearWishlistLocal();
          set({
            currentUser: null,
            isAdminLoggedIn: false,
            adminEmail: null,
          });
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
            const addrRes = await apiClient
              .get<{ success: boolean; data: any[] }>('/auth/me/addresses')
              .catch(() => null);
            const savedAddresses = Array.isArray(addrRes?.data)
              ? addrRes.data
              : current?.addresses || [];

            set({
              currentUser: {
                id: u.id,
                name: u.name,
                email: u.email,
                phone: u.phone || '',
                role: u.role,
                addresses: savedAddresses,
                wishlistProductIds: current?.wishlistProductIds || [],
                savedLists: current?.savedLists || [],
              },
              isAdminLoggedIn: u.role === 'ADMIN' || u.role === 'MANAGER',
              adminEmail: u.role === 'ADMIN' || u.role === 'MANAGER' ? u.email : null,
              isLoading: false,
            });
            // Merge guest cart items into authenticated user cart
            await useCartStore.getState().mergeGuestCart();
            useWishlistStore.getState().fetchWishlist();
            return true;
          }
          set({ isLoading: false });
          return false;
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      registerCustomer: async (
        name: string,
        email: string,
        password: string,
        phone?: string,
        orderId?: string
      ) => {
        set({ isLoading: true });
        try {
          const res = await apiClient.post<{
            success: boolean;
            requiresVerification?: boolean;
            email?: string;
            message?: string;
            data?: any;
          }>('/auth/register', {
            name,
            email,
            password,
            phone,
            orderId,
          });

          set({ isLoading: false });
          return {
            success: res?.success ?? true,
            requiresVerification: res?.requiresVerification ?? true,
            email: res?.email || email,
            message: res?.message || 'Verification code sent to your email',
          };
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      verifyEmail: async (email: string, otp: string) => {
        set({ isLoading: true });
        try {
          const res = await apiClient.post<{
            success: boolean;
            message: string;
            linkedOrdersCount?: number;
            data?: any;
          }>('/auth/verify-email', { email, otp });

          if (res?.data) {
            const u = res.data;
            const current = get().currentUser;
            const addrRes = await apiClient
              .get<{ success: boolean; data: any[] }>('/auth/me/addresses')
              .catch(() => null);
            const savedAddresses = Array.isArray(addrRes?.data)
              ? addrRes.data
              : current?.addresses || [];

            set({
              currentUser: {
                id: u.id,
                name: u.name,
                email: u.email,
                phone: u.phone || '',
                role: u.role,
                addresses: savedAddresses,
                wishlistProductIds: current?.wishlistProductIds || [],
                savedLists: current?.savedLists || [],
              },
              isAdminLoggedIn: u.role === 'ADMIN' || u.role === 'MANAGER',
              adminEmail: u.role === 'ADMIN' || u.role === 'MANAGER' ? u.email : null,
              isLoading: false,
            });
            await useCartStore.getState().mergeGuestCart();
            useWishlistStore.getState().fetchWishlist();
          } else {
            set({ isLoading: false });
          }

          return {
            success: true,
            message: res?.message || 'Email verified successfully',
            data: res?.data,
          };
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      resendVerificationOtp: async (email: string) => {
        try {
          const res = await apiClient.post<{ success: boolean; message: string }>(
            '/auth/resend-verification-otp',
            { email }
          );
          return {
            success: true,
            message: res?.message || 'A new verification code has been sent.',
          };
        } catch (err) {
          throw err;
        }
      },

      logoutCustomer: async () => {
        try {
          await apiClient.post('/auth/logout');
        } catch {
          // Continue local cleanup even if network fails
        }
        // Clear local cart and wishlist to guarantee zero cross-customer data exposure
        useCartStore.getState().clearCartLocal();
        useWishlistStore.getState().clearWishlistLocal();
        set({ currentUser: null, isAdminLoggedIn: false, adminEmail: null });
      },

      loginAdmin: async (email: string, password = 'AdminPassword123!') => {
        set({ isLoading: true });
        try {
          let res: any;
          try {
            res = await apiClient.post<{ success: boolean; data: any }>('/auth/admin/login', {
              email,
              password,
            });
          } catch (adminErr: any) {
            if (adminErr?.statusCode === 404) {
              res = await apiClient.post<{ success: boolean; data: any }>('/auth/login', {
                email,
                password,
              });
            } else {
              throw adminErr;
            }
          }

          if (res?.data) {
            const u = res.data;
            if (u.role !== 'ADMIN' && u.role !== 'MANAGER' && u.role !== 'STAFF') {
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
          await apiClient.post('/auth/admin/logout').catch(() => apiClient.post('/auth/logout'));
        } catch {}
        set({ isAdminLoggedIn: false, adminEmail: null });
      },

      toggleWishlist: (productId: string) => {
        const user = get().currentUser;
        if (!user) return;

        useWishlistStore.getState().toggleWishlist({ id: productId } as any);

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
        return useWishlistStore.getState().isInWishlist(productId);
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

// Synchronize global API client authentication rejections with userStore
if (typeof window !== 'undefined') {
  apiClient.onAuthFailure(() => {
    const state = useUserStore.getState();
    if (state.isAdminLoggedIn || state.currentUser) {
      useUserStore.setState({
        currentUser: null,
        isAdminLoggedIn: false,
        adminEmail: null,
      });

      // If user is currently on an admin route, redirect to login with safe returnUrl
      if (
        window.location.pathname.startsWith('/admin') &&
        window.location.pathname !== '/admin/login'
      ) {
        const returnUrl = encodeURIComponent(
          window.location.pathname + window.location.search
        );
        window.location.href = `/admin/login?returnUrl=${returnUrl}`;
      }
    }
  });
}
