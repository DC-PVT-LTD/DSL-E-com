import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, AuditLog } from '../../generated/prisma';
import { AuditLogQueryDto } from './dto/audit-query.dto';
import {
  toPrismaPagination,
  createPaginationMeta,
} from '../../common/pagination/pagination.util';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../common/interfaces/api-response.interface';

const SENSITIVE_AUDIT_KEYS = new Set([
  'costpricecents',
  'costprice',
  'password',
  'passwordhash',
  'refreshtoken',
  'secret',
  'token',
]);

export interface RecordAuditLogParams {
  action: string;
  entityType: string;
  entityId: string;
  userId?: string | null;
  summary: string;
  changes?: Record<string, { old?: any; new?: any }>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Sanitizes object to remove sensitive keys (passwords, tokens, internal cost prices).
   */
  sanitizeChanges(
    changes?: Record<string, { old?: any; new?: any }>
  ): Record<string, { old?: any; new?: any }> | undefined {
    if (!changes) return undefined;

    const sanitized: Record<string, { old?: any; new?: any }> = {};
    for (const [key, value] of Object.entries(changes)) {
      if (SENSITIVE_AUDIT_KEYS.has(key.toLowerCase())) {
        continue;
      }
      sanitized[key] = value;
    }

    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
  }

  /**
   * Computes changes between old state and new state while stripping sensitive fields.
   */
  computeDiff(
    oldObj: Record<string, any>,
    newObj: Record<string, any>,
    trackedKeys?: string[]
  ): Record<string, { old?: any; new?: any }> {
    const diff: Record<string, { old?: any; new?: any }> = {};
    const keys = trackedKeys || Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));

    for (const key of keys) {
      if (SENSITIVE_AUDIT_KEYS.has(key.toLowerCase())) {
        continue;
      }
      const oldVal = oldObj[key];
      const newVal = newObj[key];

      // Deep compare primitives / arrays / objects via JSON serialization
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        diff[key] = { old: oldVal, new: newVal };
      }
    }

    return diff;
  }

  /**
   * Persists an audit log entry. Can execute within an existing Prisma transaction client.
   */
  async recordAuditLog(
    params: RecordAuditLogParams,
    tx?: Prisma.TransactionClient
  ): Promise<AuditLog> {
    const client = tx || this.prisma;
    const sanitizedChanges = this.sanitizeChanges(params.changes);

    let description = params.summary;
    if (sanitizedChanges) {
      description = `${params.summary} | ${JSON.stringify(sanitizedChanges)}`;
    }

    try {
      const log = await client.auditLog.create({
        data: {
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          description,
          userId: params.userId || null,
        },
      });

      this.logger.log(
        `Audit: [${params.action}] ${params.entityType}:${params.entityId} by user:${params.userId || 'system'}`
      );
      return log;
    } catch (err: any) {
      this.logger.error(`Failed to write audit log for ${params.entityType}:${params.entityId}`, err);
      // We log error; if inside a transaction, the caller tx will determine rollback
      throw err;
    }
  }

  /**
   * Retrieves paginated audit logs with optional filtering.
   */
  async findAll(query: AuditLogQueryDto): Promise<PaginatedResponse<any>> {
    const where: Prisma.AuditLogWhereInput = {};

    if (query.entityType) {
      where.entityType = query.entityType;
    }
    if (query.entityId) {
      where.entityId = query.entityId;
    }
    if (query.action) {
      where.action = query.action;
    }
    if (query.userId) {
      where.userId = query.userId;
    }

    const { skip, take } = toPrismaPagination(query);
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    const [totalItems, items] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),
    ]);

    const meta = createPaginationMeta(totalItems, query.page, query.limit);
    return createPaginatedResponse(items, meta);
  }
}
