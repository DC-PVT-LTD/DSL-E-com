export interface StoredFile {
  url: string;
  path: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface StorageDriver {
  upload(file: Express.Multer.File, folder: string): Promise<StoredFile>;
  delete(path: string): Promise<void>;
  getPublicUrl(path: string): string;
}

