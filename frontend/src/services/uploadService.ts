import { UploadedListDocument, ExtractedStationeryItem } from '@/types/upload';
import { productService } from './productService';

const UPLOADS_STORAGE_KEY = 'dsl_uploaded_lists_v1';

const INITIAL_MOCK_UPLOADS: UploadedListDocument[] = [
  {
    id: 'upl-sample-1',
    fileName: 'grade-8-booklist-ananda-college.jpg',
    fileSizeBytes: 2450000,
    fileType: 'image/jpeg',
    uploadedAt: '2026-01-25T11:20:00Z',
    status: 'reviewed',
    isSimulatedOCR: true,
    customerNotes: 'Please ensure high quality CR books are included.',
    extractedItems: [
      {
        id: 'ext-1',
        rawText: '1. Atlas CR Books 120 Pages Single Rule - 6 Nos',
        itemDescription: 'Atlas CR Book 120 Pages - Single Line',
        quantity: 6,
        confidence: 'high',
        confidenceScore: 0.96,
        matchedProductId: 'prod-cr-120-single',
        candidateProductIds: ['prod-cr-120-single', 'prod-cr-120-square'],
        status: 'matched',
      },
      {
        id: 'ext-2',
        rawText: '2. Blue Chooty Pens - 10 Pack',
        itemDescription: 'Atlas Chooty Ballpoint Pen Pack of 10',
        quantity: 1,
        confidence: 'high',
        confidenceScore: 0.94,
        matchedProductId: 'prod-atlas-chooty-pen',
        candidateProductIds: ['prod-atlas-chooty-pen'],
        status: 'matched',
      },
      {
        id: 'ext-3',
        rawText: '3. Math Compass Instrument Box - 1 Box',
        itemDescription: 'Atlas Premier Mathematical Instrument Box',
        quantity: 1,
        confidence: 'medium',
        confidenceScore: 0.88,
        matchedProductId: 'prod-atlas-geometry-box',
        candidateProductIds: ['prod-atlas-geometry-box'],
        status: 'matched',
      },
      {
        id: 'ext-4',
        rawText: '4. Pastel Textliners 6 Colors',
        itemDescription: 'Faber-Castell Pastel Textliner Highlighter Set of 6',
        quantity: 1,
        confidence: 'high',
        confidenceScore: 0.92,
        matchedProductId: 'prod-faber-textliner-pastel',
        candidateProductIds: ['prod-faber-textliner-pastel'],
        status: 'matched',
      },
    ],
  },
];

class UploadService {
  private uploads: UploadedListDocument[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.initData();
  }

  private initData() {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(UPLOADS_STORAGE_KEY);
        if (stored) {
          this.uploads = JSON.parse(stored);
          return;
        }
      } catch (err) {
        console.error('Error loading uploads:', err);
      }
    }
    this.uploads = [...INITIAL_MOCK_UPLOADS];
  }

  private persistAndNotify() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(UPLOADS_STORAGE_KEY, JSON.stringify(this.uploads));
      } catch (err) {
        console.error('Error persisting uploads:', err);
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

  public getAll(): UploadedListDocument[] {
    return [...this.uploads];
  }

  public getById(id: string): UploadedListDocument | undefined {
    return this.uploads.find((u) => u.id === id);
  }

  /**
   * Simulates processing of an uploaded booklist image or PDF document
   */
  public simulateUpload(file: { name: string; size: number; type: string }, customerNotes?: string): UploadedListDocument {
    const allProducts = productService.getAll();
    const crBook = allProducts.find((p) => p.slug === 'atlas-cr-book-120-pages-single-line') || allProducts[0];
    const penPack = allProducts.find((p) => p.slug === 'atlas-chooty-ballpoint-pen-pack-10') || allProducts[1];
    const mathBox = allProducts.find((p) => p.slug === 'atlas-premier-mathematical-instrument-box') || allProducts[2];
    const pencils = allProducts.find((p) => p.slug === 'nataraj-621-ruby-pencils-pack-10') || allProducts[3];

    const extractedItems: ExtractedStationeryItem[] = [
      {
        id: `ext-${Date.now()}-1`,
        rawText: 'CR Books Single Line 120 Pages - 4 Nos',
        itemDescription: crBook.name,
        quantity: 4,
        confidence: 'high',
        confidenceScore: 0.95,
        matchedProductId: crBook.id,
        candidateProductIds: [crBook.id],
        status: 'matched',
      },
      {
        id: `ext-${Date.now()}-2`,
        rawText: 'Blue Ballpoint Pens 0.7mm - 1 Pack (10)',
        itemDescription: penPack.name,
        quantity: 1,
        confidence: 'high',
        confidenceScore: 0.93,
        matchedProductId: penPack.id,
        candidateProductIds: [penPack.id],
        status: 'matched',
      },
      {
        id: `ext-${Date.now()}-3`,
        rawText: 'Mathematical Instrument Box - 1 Set',
        itemDescription: mathBox.name,
        quantity: 1,
        confidence: 'medium',
        confidenceScore: 0.86,
        matchedProductId: mathBox.id,
        candidateProductIds: [mathBox.id],
        status: 'matched',
      },
      {
        id: `ext-${Date.now()}-4`,
        rawText: 'HB Writing Pencils with Sharpener',
        itemDescription: pencils.name,
        quantity: 1,
        confidence: 'high',
        confidenceScore: 0.91,
        matchedProductId: pencils.id,
        candidateProductIds: [pencils.id],
        status: 'matched',
      },
    ];

    const newDoc: UploadedListDocument = {
      id: `upl-${Date.now()}`,
      fileName: file.name,
      fileSizeBytes: file.size,
      fileType: (file.type as UploadedListDocument['fileType']) || 'image/jpeg',
      uploadedAt: new Date().toISOString(),
      status: 'processed',
      isSimulatedOCR: true,
      extractedItems,
      customerNotes,
    };

    this.uploads.unshift(newDoc);
    this.persistAndNotify();
    return newDoc;
  }

  public updateExtractedItem(
    uploadId: string,
    itemId: string,
    updates: Partial<ExtractedStationeryItem>
  ): boolean {
    const doc = this.getById(uploadId);
    if (!doc) return false;

    const item = doc.extractedItems.find((i) => i.id === itemId);
    if (!item) return false;

    Object.assign(item, updates);
    this.persistAndNotify();
    return true;
  }

  public updateUploadStatus(uploadId: string, status: UploadedListDocument['status']): boolean {
    const doc = this.getById(uploadId);
    if (!doc) return false;
    doc.status = status;
    this.persistAndNotify();
    return true;
  }
}

export const uploadService = new UploadService();
