import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, AuditLog } from '../../generated/prisma';
import { AuditLogQueryDto } from './dto/audit-query.dto';
import {
  createPaginationMeta,
} from '../../common/pagination/pagination.util';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../common/interfaces/api-response.interface';

const SENSITIVE_KEY_SUBSTRINGS = [
  'password',
  'secret',
  'token',
  'cvv',
  'cvc',
  'cardnumber',
  'creditcard',
  'accountnumber',
  'apikey',
  'costprice',
  'privatekey',
];

const SENSITIVE_EXACT_KEYS = new Set([
  'auth',
  'authorization',
  'jwt',
  'hash',
  'salt',
  'pass',
  'pin',
]);

export function isSensitiveKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  const normalized = key.replace(/[-_\s]/g, '').toLowerCase();
  if (SENSITIVE_EXACT_KEYS.has(normalized)) return true;
  for (const sub of SENSITIVE_KEY_SUBSTRINGS) {
    if (normalized.includes(sub)) return true;
  }
  return false;
}

export type AuditSourceType = 'AUDIT_LOG' | 'ORDER_AUDIT_LOG';

export interface UnifiedAuditActor {
  id: string | null;
  name: string;
  email?: string | null;
  role?: string | null;
}

export interface UnifiedAuditLogEntry {
  id: string;
  source: AuditSourceType;
  action: string;
  description: string;
  actor: UnifiedAuditActor;
  entityType: string;
  entityId: string;
  orderNumber?: string | null;
  fieldChanged?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  reason?: string | null;
  metadata?: Record<string, any> | null;
  timestamp: string;
  ipAddress: string;
}

export interface AuditSummaryResponse {
  totalEvents: number;
  generalAuditEvents: number;
  orderAuditEvents: number;
  todayEvents: number;
}

export interface RecordAuditLogParams {
  action: string;
  entityType: string;
  entityId: string;
  userId?: string | null;
  summary: string;
  changes?: Record<string, { old?: any; new?: any }>;
}

/**
 * Parses date inputs with Asia/Colombo timezone boundaries (+05:30).
 */
export function parseColomboDateRange(
  dateFrom?: string,
  dateTo?: string
): { gte?: Date; lte?: Date } | undefined {
  if (!dateFrom && !dateTo) return undefined;

  const range: { gte?: Date; lte?: Date } = {};

  if (dateFrom) {
    const trimmed = dateFrom.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      range.gte = new Date(`${trimmed}T00:00:00.000+05:30`);
    } else {
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) range.gte = parsed;
    }
  }

  if (dateTo) {
    const trimmed = dateTo.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      range.lte = new Date(`${trimmed}T23:59:59.999+05:30`);
    } else {
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) range.lte = parsed;
    }
  }

  return range;
}

/**
 * Returns midnight of today in Asia/Colombo timezone (+05:30).
 */
export function getStartOfTodayColombo(): Date {
  const now = new Date();
  const colomboTime = new Date(now.getTime() + 5.5 * 3600 * 1000);
  const year = colomboTime.getUTCFullYear();
  const month = String(colomboTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(colomboTime.getUTCDate()).padStart(2, '0');
  return new Date(`${year}-${month}-${day}T00:00:00.000+05:30`);
}

/**
 * Recursively redacts sensitive keys and values from audit records before presentation.
 */
export function redactSensitiveAuditData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') {
    if (typeof data === 'string') {
      if (/^eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(data)) {
        return '[REDACTED_TOKEN]';
      }
      if (/^\$2[aby]\$[0-9]{2}\$[a-zA-Z0-9./]{20,}$/.test(data)) {
        return '[REDACTED_HASH]';
      }
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveAuditData(item));
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (isSensitiveKey(key)) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = redactSensitiveAuditData(value);
    }
  }
  return result;
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
      if (isSensitiveKey(key)) {
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
      if (isSensitiveKey(key)) {
        continue;
      }
      const oldVal = oldObj[key];
      const newVal = newObj[key];

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
          userId: params.userId || null,
          description,
        },
      });

      this.logger.log(`Audit: [${params.action}] ${params.entityType}:${params.entityId} by user:${params.userId || 'system'}`);
      return log;
    } catch (err: any) {
      this.logger.error(`Failed to write audit log for ${params.entityType}:${params.entityId}`, err);
      throw err;
    }
  }

  /**
   * Normalizes an AuditLog row to the UnifiedAuditLogEntry structure.
   */
  mapAuditLogToUnified(log: any): UnifiedAuditLogEntry {
    let description = log.description || '';
    let metadata: Record<string, any> | null = null;

    if (description.includes(' | {')) {
      const splitIdx = description.indexOf(' | {');
      const summaryPart = description.slice(0, splitIdx);
      const jsonPart = description.slice(splitIdx + 3);
      try {
        metadata = JSON.parse(jsonPart);
        description = summaryPart;
      } catch {
        // Fallback to full description if parsing fails
      }
    }

    const actor: UnifiedAuditActor = {
      id: log.userId || null,
      name: log.user?.name || (log.userId ? 'Administrator' : 'System Automated Service'),
      email: log.user?.email || null,
      role: log.user?.role || (log.userId ? 'ADMIN' : 'SYSTEM'),
    };

    return {
      id: log.id,
      source: 'AUDIT_LOG',
      action: log.action,
      description,
      actor,
      entityType: (log.entityType || 'SYSTEM').toUpperCase(),
      entityId: log.entityId,
      orderNumber: (log.entityType || '').toLowerCase() === 'order' ? log.entityId : null,
      fieldChanged: null,
      previousValue: null,
      newValue: null,
      reason: null,
      metadata: redactSensitiveAuditData(metadata),
      timestamp: log.createdAt instanceof Date ? log.createdAt.toISOString() : new Date(log.createdAt).toISOString(),
      ipAddress: 'Not available',
    };
  }

  /**
   * Normalizes an OrderAuditLog row to the UnifiedAuditLogEntry structure.
   */
  mapOrderAuditLogToUnified(log: any): UnifiedAuditLogEntry {
    const orderNumber = log.order?.orderNumber || log.orderId;
    let description = log.reason || '';
    if (!description) {
      if (log.fieldChanged && log.newValue) {
        description = `${log.action} on order ${orderNumber}: changed ${log.fieldChanged} to ${log.newValue}`;
      } else {
        description = `${log.action} recorded on order ${orderNumber}`;
      }
    }

    let parsedPrev: any = log.previousValue;
    let parsedNew: any = log.newValue;
    try {
      if (typeof log.previousValue === 'string' && (log.previousValue.startsWith('{') || log.previousValue.startsWith('['))) {
        parsedPrev = JSON.parse(log.previousValue);
      }
    } catch {
      // Leave string
    }
    try {
      if (typeof log.newValue === 'string' && (log.newValue.startsWith('{') || log.newValue.startsWith('['))) {
        parsedNew = JSON.parse(log.newValue);
      }
    } catch {
      // Leave string
    }

    const metadata: Record<string, any> = {};
    if (log.fieldChanged) metadata.fieldChanged = log.fieldChanged;
    if (log.previousValue !== null && log.previousValue !== undefined) {
      metadata.previousValue = redactSensitiveAuditData(parsedPrev);
    }
    if (log.newValue !== null && log.newValue !== undefined) {
      metadata.newValue = redactSensitiveAuditData(parsedNew);
    }
    if (log.reason) metadata.reason = log.reason;

    const actor: UnifiedAuditActor = {
      id: log.adminId || null,
      name: log.admin?.name || log.adminName || (log.adminId ? 'Administrator' : 'System'),
      email: log.admin?.email || null,
      role: log.admin?.role ? String(log.admin.role) : (log.adminId ? null : 'SYSTEM'),
    };

    return {
      id: log.id,
      source: 'ORDER_AUDIT_LOG',
      action: log.action,
      description,
      actor,
      entityType: 'ORDER',
      entityId: log.orderId,
      orderNumber: log.order?.orderNumber || null,
      fieldChanged: log.fieldChanged || null,
      previousValue: redactSensitiveAuditData(log.previousValue),
      newValue: redactSensitiveAuditData(log.newValue),
      reason: log.reason || null,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
      timestamp: log.createdAt instanceof Date ? log.createdAt.toISOString() : new Date(log.createdAt).toISOString(),
      ipAddress: 'Not available',
    };
  }

  /**
   * Normalizes a raw SQL query row from the unified CTE to UnifiedAuditLogEntry.
   */
  mapRawRowToUnified(row: any): UnifiedAuditLogEntry {
    let description = row.description || '';
    let metadata: Record<string, any> | null = null;

    if (row.source === 'AUDIT_LOG') {
      if (description.includes(' | {')) {
        const splitIdx = description.indexOf(' | {');
        const summaryPart = description.slice(0, splitIdx);
        const jsonPart = description.slice(splitIdx + 3);
        try {
          metadata = JSON.parse(jsonPart);
          description = summaryPart;
        } catch {
          // Fallback to full description if parsing fails
        }
      }
    } else {
      const metaObj: Record<string, any> = {};
      if (row.fieldChanged) metaObj.fieldChanged = row.fieldChanged;
      if (row.previousValue !== null && row.previousValue !== undefined) {
        let parsed = row.previousValue;
        try {
          if (typeof row.previousValue === 'string' && (row.previousValue.startsWith('{') || row.previousValue.startsWith('['))) {
            parsed = JSON.parse(row.previousValue);
          }
        } catch {
          // Leave as string
        }
        metaObj.previousValue = redactSensitiveAuditData(parsed);
      }
      if (row.newValue !== null && row.newValue !== undefined) {
        let parsed = row.newValue;
        try {
          if (typeof row.newValue === 'string' && (row.newValue.startsWith('{') || row.newValue.startsWith('['))) {
            parsed = JSON.parse(row.newValue);
          }
        } catch {
          // Leave as string
        }
        metaObj.newValue = redactSensitiveAuditData(parsed);
      }
      if (row.reason) metaObj.reason = row.reason;
      if (Object.keys(metaObj).length > 0) metadata = metaObj;
    }

    const actor: UnifiedAuditActor = {
      id: row.actorId || null,
      name: row.actorName || (row.actorId ? 'Administrator' : 'System Automated Service'),
      email: row.actorEmail || null,
      role: row.actorRole || (row.actorId ? null : 'SYSTEM'),
    };

    return {
      id: row.id,
      source: row.source,
      action: row.action,
      description,
      actor,
      entityType: (row.entityType || 'SYSTEM').toUpperCase(),
      entityId: row.entityId,
      orderNumber: row.orderNumber || ((row.entityType || '').toLowerCase() === 'order' ? row.entityId : null),
      fieldChanged: row.fieldChanged || null,
      previousValue: redactSensitiveAuditData(row.previousValue),
      newValue: redactSensitiveAuditData(row.newValue),
      reason: row.reason || null,
      metadata: redactSensitiveAuditData(metadata),
      timestamp: row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date(row.createdAt).toISOString(),
      ipAddress: 'Not available',
    };
  }

  /**
   * Retrieves unified audit log records across AuditLog and OrderAuditLog with global sorting and pagination.
   */
  async findAll(query: AuditLogQueryDto): Promise<PaginatedResponse<UnifiedAuditLogEntry>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;
    const source = query.source || 'ALL';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
    const sortOrderSql = sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    const sortByCol =
      query.sortBy === 'action'
        ? Prisma.sql`action`
        : query.sortBy === 'entityType'
        ? Prisma.sql`"entityType"`
        : Prisma.sql`"createdAt"`;

    const auditConditions: Prisma.Sql[] = [];
    const orderConditions: Prisma.Sql[] = [];

    const actorId = query.actorId || query.userId;
    if (actorId) {
      auditConditions.push(Prisma.sql`a."userId" = ${actorId}`);
      orderConditions.push(Prisma.sql`oal."adminId" = ${actorId}`);
    }

    if (query.action) {
      auditConditions.push(Prisma.sql`LOWER(a.action) = LOWER(${query.action})`);
      orderConditions.push(Prisma.sql`LOWER(oal.action) = LOWER(${query.action})`);
    }

    if (query.entityId) {
      auditConditions.push(Prisma.sql`a."entityId" = ${query.entityId}`);
      orderConditions.push(Prisma.sql`oal."orderId" = ${query.entityId}`);
    }

    if (query.entityType) {
      const normType = query.entityType.trim().toLowerCase();
      auditConditions.push(Prisma.sql`LOWER(a."entityType") = ${normType}`);
      if (normType !== 'order') {
        orderConditions.push(Prisma.sql`1=0`);
      }
    }

    const dateRange = parseColomboDateRange(query.dateFrom, query.dateTo);
    if (dateRange) {
      if (dateRange.gte) {
        auditConditions.push(Prisma.sql`a."createdAt" >= ${dateRange.gte}`);
        orderConditions.push(Prisma.sql`oal."createdAt" >= ${dateRange.gte}`);
      }
      if (dateRange.lte) {
        auditConditions.push(Prisma.sql`a."createdAt" <= ${dateRange.lte}`);
        orderConditions.push(Prisma.sql`oal."createdAt" <= ${dateRange.lte}`);
      }
    }

    if (query.search && query.search.trim()) {
      const pattern = `%${query.search.trim()}%`;
      auditConditions.push(Prisma.sql`(
        a.action ILIKE ${pattern} OR 
        a.description ILIKE ${pattern} OR 
        a."entityId" ILIKE ${pattern} OR 
        u.name ILIKE ${pattern} OR 
        u.email ILIKE ${pattern}
      )`);
      orderConditions.push(Prisma.sql`(
        oal.action ILIKE ${pattern} OR 
        oal.reason ILIKE ${pattern} OR 
        oal."fieldChanged" ILIKE ${pattern} OR 
        oal."adminName" ILIKE ${pattern} OR 
        u.name ILIKE ${pattern} OR 
        u.email ILIKE ${pattern} OR 
        oal."orderId" ILIKE ${pattern} OR 
        o."orderNumber" ILIKE ${pattern}
      )`);
    }

    const auditWhere =
      auditConditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(auditConditions, ' AND ')}` : Prisma.empty;
    const orderWhere =
      orderConditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(orderConditions, ' AND ')}` : Prisma.empty;

    const includeAudit = source === 'ALL' || source === 'AUDIT_LOG';
    const includeOrder = source === 'ALL' || source === 'ORDER_AUDIT_LOG';

    const branchQueries: Prisma.Sql[] = [];
    if (includeAudit) {
      branchQueries.push(Prisma.sql`
        SELECT 
          a.id AS id,
          'AUDIT_LOG' AS source,
          a.action AS action,
          a."entityType" AS "entityType",
          a."entityId" AS "entityId",
          a.description AS description,
          a."userId" AS "actorId",
          u.name AS "actorName",
          u.email AS "actorEmail",
          u.role::text AS "actorRole",
          NULL AS "orderNumber",
          NULL AS "fieldChanged",
          NULL AS "previousValue",
          NULL AS "newValue",
          NULL AS reason,
          a."createdAt" AS "createdAt"
        FROM "AuditLog" a
        LEFT JOIN "User" u ON a."userId" = u.id
        ${auditWhere}
      `);
    }

    if (includeOrder) {
      branchQueries.push(Prisma.sql`
        SELECT 
          oal.id AS id,
          'ORDER_AUDIT_LOG' AS source,
          oal.action AS action,
          'ORDER' AS "entityType",
          oal."orderId" AS "entityId",
          COALESCE(oal.reason, oal.action || ' on order ' || COALESCE(o."orderNumber", oal."orderId")) AS description,
          oal."adminId" AS "actorId",
          COALESCE(u.name, oal."adminName", 'System') AS "actorName",
          u.email AS "actorEmail",
          CASE 
            WHEN u.role IS NOT NULL THEN u.role::text 
            WHEN oal."adminId" IS NULL THEN 'SYSTEM' 
            ELSE NULL 
          END AS "actorRole",
          o."orderNumber" AS "orderNumber",
          oal."fieldChanged" AS "fieldChanged",
          oal."previousValue" AS "previousValue",
          oal."newValue" AS "newValue",
          oal.reason AS reason,
          oal."createdAt" AS "createdAt"
        FROM "OrderAuditLog" oal
        LEFT JOIN "Order" o ON oal."orderId" = o.id
        LEFT JOIN "User" u ON oal."adminId" = u.id
        ${orderWhere}
      `);
    }

    const unionBranches = Prisma.join(branchQueries, ' UNION ALL ');

    const fullQuery = Prisma.sql`
      WITH unified_records AS (
        ${unionBranches}
      )
      SELECT * FROM unified_records
      ORDER BY ${sortByCol} ${sortOrderSql}, source ${sortOrderSql}, id ${sortOrderSql}
      LIMIT ${limit} OFFSET ${skip};
    `;

    const countBranches: Prisma.Sql[] = [];
    if (includeAudit) {
      countBranches.push(Prisma.sql`SELECT a.id FROM "AuditLog" a LEFT JOIN "User" u ON a."userId" = u.id ${auditWhere}`);
    }
    if (includeOrder) {
      countBranches.push(Prisma.sql`SELECT oal.id FROM "OrderAuditLog" oal LEFT JOIN "Order" o ON oal."orderId" = o.id LEFT JOIN "User" u ON oal."adminId" = u.id ${orderWhere}`);
    }
    const countUnion = Prisma.join(countBranches, ' UNION ALL ');

    const countQuery = Prisma.sql`
      WITH unified_counts AS (
        ${countUnion}
      )
      SELECT COUNT(*)::int AS count FROM unified_counts;
    `;

    const [rows, countRes] = await Promise.all([
      this.prisma.$queryRaw<any[]>(fullQuery),
      this.prisma.$queryRaw<Array<{ count: number }>>(countQuery),
    ]);

    const totalItems = countRes[0]?.count ?? 0;
    const data = (rows || []).map((r) => this.mapRawRowToUnified(r));
    const meta = createPaginationMeta(totalItems, page, limit);
    return createPaginatedResponse(data, meta);
  }

  /**
   * Returns aggregate audit volume metrics and events recorded today in Asia/Colombo.
   */
  async getSummary(): Promise<AuditSummaryResponse> {
    const startOfToday = getStartOfTodayColombo();

    const [generalAuditEvents, orderAuditEvents, auditToday, orderAuditToday] = await Promise.all([
      this.prisma.auditLog.count(),
      this.prisma.orderAuditLog.count(),
      this.prisma.auditLog.count({ where: { createdAt: { gte: startOfToday } } }),
      this.prisma.orderAuditLog.count({ where: { createdAt: { gte: startOfToday } } }),
    ]);

    return {
      totalEvents: generalAuditEvents + orderAuditEvents,
      generalAuditEvents,
      orderAuditEvents,
      todayEvents: auditToday + orderAuditToday,
    };
  }

  /**
   * Retrieves a single audit record by ID from either source.
   */
  async findById(id: string, source?: string): Promise<UnifiedAuditLogEntry> {
    if (source === 'ORDER_AUDIT_LOG') {
      const log = await this.prisma.orderAuditLog.findUnique({
        where: { id },
        include: {
          order: { select: { id: true, orderNumber: true, customerName: true, customerEmail: true } },
        },
      });
      if (!log) throw new NotFoundException(`Order audit log with ID "${id}" not found.`);
      if (log.adminId) {
        const user = await this.prisma.user.findUnique({
          where: { id: log.adminId },
          select: { id: true, name: true, email: true, role: true },
        });
        if (user) (log as any).admin = user;
      }
      return this.mapOrderAuditLogToUnified(log);
    }

    if (source === 'AUDIT_LOG') {
      const log = await this.prisma.auditLog.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      });
      if (!log) throw new NotFoundException(`Audit log with ID "${id}" not found.`);
      return this.mapAuditLogToUnified(log);
    }

    const auditLog = await this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });
    if (auditLog) {
      return this.mapAuditLogToUnified(auditLog);
    }

    const orderAudit = await this.prisma.orderAuditLog.findUnique({
      where: { id },
      include: {
        order: { select: { id: true, orderNumber: true, customerName: true, customerEmail: true } },
      },
    });
    if (orderAudit) {
      if (orderAudit.adminId) {
        const user = await this.prisma.user.findUnique({
          where: { id: orderAudit.adminId },
          select: { id: true, name: true, email: true, role: true },
        });
        if (user) (orderAudit as any).admin = user;
      }
      return this.mapOrderAuditLogToUnified(orderAudit);
    }

    throw new NotFoundException(`Audit log record with ID "${id}" not found.`);
  }

  /**
   * Phase 2: Records detailed administrator change event into AdminActivityLog
   * with before/after state snapshots, sensitive data redaction, IP, and user-agent.
   */
  async recordAdminActivity(params: {
    userId?: string;
    userEmail?: string;
    userName?: string;
    userRole?: string;
    action: string;
    entityType: string;
    entityId?: string;
    description: string;
    status?: string;
    ipAddress?: string;
    userAgent?: string;
    beforeState?: any;
    afterState?: any;
    challengeId?: string;
  }) {
    const sanitizedBefore = params.beforeState ? this.sanitizeChanges(params.beforeState) : null;
    const sanitizedAfter = params.afterState ? this.sanitizeChanges(params.afterState) : null;

    return this.prisma.adminActivityLog.create({
      data: {
        userId: params.userId || null,
        userEmail: params.userEmail || null,
        userName: params.userName || null,
        userRole: params.userRole || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId || null,
        description: params.description,
        status: params.status || 'SUCCESS',
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        beforeState: sanitizedBefore ? (sanitizedBefore as any) : undefined,
        afterState: sanitizedAfter ? (sanitizedAfter as any) : undefined,
        challengeId: params.challengeId || null,
      },
    });
  }

  /**
   * Phase 2: Lists private administrator activity logs for Super Admin Control Center.
   */
  async findAllAdminActivities(query: {
    page?: number;
    limit?: number;
    action?: string;
    entityType?: string;
    entityId?: string;
    userId?: string;
    status?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.max(1, Math.min(100, Number(query.limit || 20)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.action) where.action = { contains: query.action, mode: 'insensitive' };
    if (query.entityType) where.entityType = { contains: query.entityType, mode: 'insensitive' };
    if (query.entityId) where.entityId = query.entityId;
    if (query.userId) where.userId = query.userId;
    if (query.status && query.status !== 'ALL') where.status = query.status;

    if (query.search?.trim()) {
      where.OR = [
        { action: { contains: query.search.trim(), mode: 'insensitive' } },
        { description: { contains: query.search.trim(), mode: 'insensitive' } },
        { userEmail: { contains: query.search.trim(), mode: 'insensitive' } },
        { userName: { contains: query.search.trim(), mode: 'insensitive' } },
      ];
    }

    const dateRange = parseColomboDateRange(query.dateFrom, query.dateTo);
    if (dateRange && (dateRange.gte || dateRange.lte)) {
      where.createdAt = {};
      if (dateRange.gte) where.createdAt.gte = dateRange.gte;
      if (dateRange.lte) where.createdAt.lte = dateRange.lte;
    }

    const [items, total] = await Promise.all([
      this.prisma.adminActivityLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.adminActivityLog.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit) || 1,
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Exports administrator activity records in CSV format.
   */
  async exportActivitiesCsv(query: any): Promise<string> {
    const records = await this.prisma.adminActivityLog.findMany({
      take: 2000,
      orderBy: { createdAt: 'desc' },
    });

    const headers = [
      'ID',
      'Timestamp',
      'Action',
      'Entity Type',
      'Entity ID',
      'User Name',
      'User Email',
      'User Role',
      'Status',
      'IP Address',
      'Description',
    ];

    const rows = records.map((r) => [
      r.id,
      r.createdAt.toISOString(),
      `"${(r.action || '').replace(/"/g, '""')}"`,
      `"${(r.entityType || '').replace(/"/g, '""')}"`,
      `"${(r.entityId || '').replace(/"/g, '""')}"`,
      `"${(r.userName || '').replace(/"/g, '""')}"`,
      `"${(r.userEmail || '').replace(/"/g, '""')}"`,
      `"${(r.userRole || '').replace(/"/g, '""')}"`,
      r.status,
      `"${(r.ipAddress || '').replace(/"/g, '""')}"`,
      `"${(r.description || '').replace(/"/g, '""')}"`,
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }
}
