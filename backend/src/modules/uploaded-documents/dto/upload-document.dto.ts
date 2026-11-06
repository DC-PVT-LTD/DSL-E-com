import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const uploadDocumentSchema = z.object({
  customerNotes: z.string().max(1000).optional(),
  sessionId: z.string().optional(),
});

export class UploadDocumentDto {
  @ApiPropertyOptional({ description: 'Optional customer instructions or handwritten notes' })
  customerNotes?: string;

  @ApiPropertyOptional({ description: 'Guest session ID if unauthenticated' })
  sessionId?: string;
}
