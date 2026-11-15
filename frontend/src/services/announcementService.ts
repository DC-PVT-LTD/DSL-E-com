import { apiClient } from '@/lib/api/apiClient';

export interface AnnouncementAd {
  id: string;
  text: string;
  link?: string;
  isActive: boolean;
  priority: number;
  createdAt: string;
}

const STORAGE_KEY = 'dsl_announcement_ribbon_v1';

export const DEFAULT_ANNOUNCEMENTS: AnnouncementAd[] = [
  {
    id: 'ann-1',
    text: 'Free Islandwide Delivery On Orders Over Rs. 5,000! 🚚',
    isActive: true,
    priority: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'ann-2',
    text: 'Save Up to 18% On All Grade School Stationery Packs 🎒',
    link: '/school-packs',
    isActive: true,
    priority: 2,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'ann-3',
    text: '100% Genuine Authorised Brands • Speed, Doms, Linc, Amigo & More ✨',
    link: '/brands',
    isActive: true,
    priority: 3,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'ann-5',
    text: 'Direct Distributor Wholesale Pricing for Schools & Corporate Offices 📦',
    link: '/bulk-order',
    isActive: true,
    priority: 5,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'ann-6',
    text: 'New Term & School Essentials Collection In Stock Now! ✏️',
    link: '/shop',
    isActive: true,
    priority: 6,
    createdAt: new Date().toISOString(),
  },
];

class AnnouncementService {
  private announcements: AnnouncementAd[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.initData();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) {
          this.initData();
          this.notifyListeners();
        }
      });
    }
  }

  private initData() {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.announcements = parsed;
            return;
          }
        }
      } catch (err) {
        console.error('Failed to load announcements from storage:', err);
      }
    }
    this.announcements = [...DEFAULT_ANNOUNCEMENTS];
  }

  private persistAndNotify() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.announcements));
      } catch (err) {
        console.error('Failed to persist announcements:', err);
      }
    }
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Error in announcement listener:', err);
      }
    });
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getAll(): AnnouncementAd[] {
    return [...this.announcements];
  }

  public getActive(): AnnouncementAd[] {
    return this.announcements
      .filter((a) => a.isActive)
      .sort((a, b) => (a.priority || 0) - (b.priority || 0));
  }

  public add(item: { text: string; link?: string; isActive?: boolean; priority?: number }): AnnouncementAd {
    const newAd: AnnouncementAd = {
      id: `ann-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      text: item.text.trim(),
      link: item.link?.trim() || undefined,
      isActive: item.isActive !== undefined ? item.isActive : true,
      priority: item.priority || this.announcements.length + 1,
      createdAt: new Date().toISOString(),
    };

    this.announcements.push(newAd);
    this.persistAndNotify();
    return newAd;
  }

  public update(id: string, updates: Partial<Omit<AnnouncementAd, 'id' | 'createdAt'>>): AnnouncementAd | null {
    const index = this.announcements.findIndex((a) => a.id === id);
    if (index === -1) return null;

    this.announcements[index] = {
      ...this.announcements[index],
      ...updates,
      text: updates.text !== undefined ? updates.text.trim() : this.announcements[index].text,
      link: updates.link !== undefined ? (updates.link.trim() || undefined) : this.announcements[index].link,
    };

    this.persistAndNotify();
    return this.announcements[index];
  }

  public delete(id: string): boolean {
    const initialLen = this.announcements.length;
    this.announcements = this.announcements.filter((a) => a.id !== id);
    if (this.announcements.length !== initialLen) {
      this.persistAndNotify();
      return true;
    }
    return false;
  }

  public toggleActive(id: string): boolean {
    const item = this.announcements.find((a) => a.id === id);
    if (item) {
      item.isActive = !item.isActive;
      this.persistAndNotify();
      return true;
    }
    return false;
  }

  public reorder(reorderedIds: string[]): void {
    const idMap = new Map(this.announcements.map((a) => [a.id, a]));
    const nextList: AnnouncementAd[] = [];

    reorderedIds.forEach((id, idx) => {
      const found = idMap.get(id);
      if (found) {
        found.priority = idx + 1;
        nextList.push(found);
        idMap.delete(id);
      }
    });

    // Add remaining items
    idMap.forEach((rem) => {
      rem.priority = nextList.length + 1;
      nextList.push(rem);
    });

    this.announcements = nextList;
    this.persistAndNotify();
  }

  public resetToDefault(): void {
    this.announcements = [...DEFAULT_ANNOUNCEMENTS];
    this.persistAndNotify();
  }
}

export const announcementService = new AnnouncementService();

