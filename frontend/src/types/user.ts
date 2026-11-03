import { ShippingAddress } from './order';

export interface SavedList {
  id: string;
  title: string;
  description?: string;
  itemProductIds: string[];
  createdAt: string;
}

export interface CustomerUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  addresses: (ShippingAddress & { id: string; isDefault?: boolean })[];
  wishlistProductIds: string[];
  savedLists: SavedList[];
  isDemoAccount: boolean;
}
