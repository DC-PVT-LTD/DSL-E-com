import { SchoolPack, SchoolPackItem } from '@/types/school-pack';
import { INITIAL_SCHOOL_PACKS } from '@/mocks/school-packs';
import { productService } from './productService';

const PACKS_STORAGE_KEY = 'dsl_school_packs_v1';

class SchoolPackService {
  private packs: SchoolPack[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.initData();
  }

  private initData() {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(PACKS_STORAGE_KEY);
        if (stored) {
          this.packs = JSON.parse(stored);
          return;
        }
      } catch (err) {
        console.error('Error loading school packs:', err);
      }
    }
    this.packs = [...INITIAL_SCHOOL_PACKS];
  }

  private persistAndNotify() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(PACKS_STORAGE_KEY, JSON.stringify(this.packs));
      } catch (err) {
        console.error('Error saving school packs:', err);
      }
    }
    this.listeners.forEach((listener) => listener());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public resetToDefault(): void {
    this.packs = [...INITIAL_SCHOOL_PACKS];
    this.persistAndNotify();
  }

  public getAll(includeInactive = false): SchoolPack[] {
    if (includeInactive) return [...this.packs];
    return this.packs.filter((p) => p.isActive);
  }

  public getById(id: string): SchoolPack | undefined {
    return this.packs.find((p) => p.id === id || p.slug === id);
  }

  public calculatePackTotal(items: { unitPriceCents: number; defaultQuantity: number }[], savingsPercentage: number): number {
    const rawTotal = items.reduce((sum, item) => sum + item.unitPriceCents * item.defaultQuantity, 0);
    const discount = Math.round((rawTotal * savingsPercentage) / 100);
    return rawTotal - discount;
  }

  public createPack(data: Omit<SchoolPack, 'id'>): SchoolPack {
    const newPack: SchoolPack = {
      ...data,
      id: `pack-${Date.now()}`,
    };
    this.packs.unshift(newPack);
    this.persistAndNotify();
    return newPack;
  }

  public updatePack(id: string, updates: Partial<SchoolPack>): SchoolPack | null {
    const index = this.packs.findIndex((p) => p.id === id);
    if (index === -1) return null;

    this.packs[index] = { ...this.packs[index], ...updates };
    this.persistAndNotify();
    return this.packs[index];
  }

  public togglePackStatus(id: string): SchoolPack | null {
    const pack = this.getById(id);
    if (!pack) return null;
    return this.updatePack(id, { isActive: !pack.isActive });
  }
}

export const schoolPackService = new SchoolPackService();
