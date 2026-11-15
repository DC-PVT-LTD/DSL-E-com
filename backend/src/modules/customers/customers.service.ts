import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UserRole, Prisma } from '../../generated/prisma';
import { CustomerQueryDto, UpdateCustomerStatusDto } from './dto/customer-query.dto';
import * as ExcelJS from 'exceljs';

export interface CustomerListItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: Date;
  primaryDistrict: string | null;
  addressesCount: number;
  orderCount: number;
  totalSpendCents: number;
  lastOrderDate: Date | null;
}

export interface CustomerDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  addresses: Array<{
    id: string;
    fullName: string;
    phone: string;
    email: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    district: string;
    postalCode: string | null;
    isDefault: boolean;
    createdAt: Date;
  }>;
  orders: Array<{
    id: string;
    orderNumber: string;
    totalCents: number;
    paymentMethod: string;
    paymentStatus: string;
    orderStatus: string;
    createdAt: Date;
    itemsCount: number;
  }>;
  orderSummary: {
    totalOrders: number;
    totalSpendCents: number;
    averageOrderValueCents: number;
    lastOrderDate: Date | null;
  };
  wishlistCount: number;
  savedListsCount: number;
}

export interface CustomerAnalytics {
  totalCustomers: number;
  activeCustomers: number;
  inactiveCustomers: number;
  verifiedEmailCount: number;
  newCustomersLast30Days: number;
  customersWithOrders: number;
  customersWithoutOrders: number;
  totalCustomerRevenueCents: number;
  byDistrict: Array<{ district: string; count: number }>;
}

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService
  ) {}

  /**
   * Retrieves paginated customers with database multi-filtering.
   * Strictly excludes administrator and staff accounts.
   */
  async findAll(query: CustomerQueryDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(200, Math.max(1, query.limit || 25));
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      role: UserRole.CUSTOMER,
    };

    // Account status filter
    if (query.status === 'active') {
      where.isActive = true;
    } else if (query.status === 'inactive') {
      where.isActive = false;
    }

    // Search filter across name, email, phone, ID
    const search = (query.search || query.q)?.trim();
    if (search) {
      const searchConditions: Prisma.UserWhereInput[] = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
      if (search.length >= 8) {
        searchConditions.push({ id: { contains: search, mode: 'insensitive' } });
      }
      where.OR = searchConditions;
    }

    // Registration date range filter
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        const start = new Date(query.startDate);
        if (!isNaN(start.getTime())) {
          where.createdAt.gte = start;
        }
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        if (!isNaN(end.getTime())) {
          where.createdAt.lte = end;
        }
      }
    }

    // District filter
    if (query.district && query.district.trim()) {
      where.addresses = {
        some: {
          district: { contains: query.district.trim(), mode: 'insensitive' },
        },
      };
    }

    // Fetch users with their addresses and orders
    const [rawTotal, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          isActive: true,
          isEmailVerified: true,
          createdAt: true,
          addresses: {
            select: {
              id: true,
              district: true,
              isDefault: true,
              city: true,
            },
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
          },
          orders: {
            select: {
              id: true,
              totalCents: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: query.sortBy === 'name'
          ? { name: query.sortOrder }
          : query.sortBy === 'email'
          ? { email: query.sortOrder }
          : { createdAt: query.sortOrder },
      }),
    ]);

    // Map and enrich customer items
    let items: CustomerListItem[] = users.map((u) => {
      const orderCount = u.orders.length;
      const totalSpendCents = u.orders.reduce((sum, o) => sum + o.totalCents, 0);
      const lastOrderDate = u.orders[0]?.createdAt || null;
      const defaultAddr = u.addresses.find((a) => a.isDefault) || u.addresses[0];
      const primaryDistrict = defaultAddr ? defaultAddr.district : null;

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        isActive: u.isActive,
        isEmailVerified: u.isEmailVerified,
        createdAt: u.createdAt,
        primaryDistrict,
        addressesCount: u.addresses.length,
        orderCount,
        totalSpendCents,
        lastOrderDate,
      };
    });

    // Has orders filter
    if (query.hasOrders === 'with_orders') {
      items = items.filter((item) => item.orderCount > 0);
    } else if (query.hasOrders === 'no_orders') {
      items = items.filter((item) => item.orderCount === 0);
    }

    // Sort by order count if requested
    if (query.sortBy === 'orderCount') {
      items.sort((a, b) =>
        query.sortOrder === 'asc' ? a.orderCount - b.orderCount : b.orderCount - a.orderCount
      );
    }

    const total = query.hasOrders !== 'all' ? items.length : rawTotal;
    const paginatedItems = items.slice(skip, skip + limit);

    return {
      items: paginatedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves single customer by ID with full order history and address details.
   */
  async findById(id: string): Promise<CustomerDetail> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        createdAt: true,
        updatedAt: true,
        addresses: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            addressLine1: true,
            addressLine2: true,
            city: true,
            district: true,
            postalCode: true,
            isDefault: true,
            createdAt: true,
          },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        },
        _count: {
          select: {
            wishlist: true,
            savedLists: true,
            savedStationeryLists: true,
          },
        },
      },
    });

    if (!user || user.role !== UserRole.CUSTOMER) {
      throw new NotFoundException(`Customer with ID "${id}" not found.`);
    }

    // Find all orders linked via userId or matching customerEmail
    const orders = await this.prisma.order.findMany({
      where: {
        OR: [
          { userId: user.id },
          { customerEmail: { equals: user.email, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        orderNumber: true,
        totalCents: true,
        paymentMethod: true,
        paymentStatus: true,
        orderStatus: true,
        createdAt: true,
        _count: {
          select: { items: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalOrders = orders.length;
    const totalSpendCents = orders.reduce((sum, o) => sum + o.totalCents, 0);
    const averageOrderValueCents = totalOrders > 0 ? Math.round(totalSpendCents / totalOrders) : 0;
    const lastOrderDate = orders[0]?.createdAt || null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      addresses: user.addresses,
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        totalCents: o.totalCents,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        orderStatus: o.orderStatus,
        createdAt: o.createdAt,
        itemsCount: o._count.items,
      })),
      orderSummary: {
        totalOrders,
        totalSpendCents,
        averageOrderValueCents,
        lastOrderDate,
      },
      wishlistCount: user._count.wishlist,
      savedListsCount: user._count.savedLists + user._count.savedStationeryLists,
    };
  }

  /**
   * Generates real database customer analytics and distribution metrics.
   */
  async getAnalytics(): Promise<CustomerAnalytics> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalCustomers,
      activeCustomers,
      inactiveCustomers,
      verifiedEmailCount,
      newCustomersLast30Days,
      customerUsers,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: UserRole.CUSTOMER } }),
      this.prisma.user.count({ where: { role: UserRole.CUSTOMER, isActive: true } }),
      this.prisma.user.count({ where: { role: UserRole.CUSTOMER, isActive: false } }),
      this.prisma.user.count({ where: { role: UserRole.CUSTOMER, isEmailVerified: true } }),
      this.prisma.user.count({
        where: {
          role: UserRole.CUSTOMER,
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      this.prisma.user.findMany({
        where: { role: UserRole.CUSTOMER },
        select: {
          id: true,
          email: true,
          addresses: { select: { district: true } },
          orders: { select: { totalCents: true } },
        },
      }),
    ]);

    let customersWithOrders = 0;
    let totalCustomerRevenueCents = 0;
    const districtCounts: Record<string, number> = {};

    for (const u of customerUsers) {
      if (u.orders.length > 0) {
        customersWithOrders++;
        for (const o of u.orders) {
          totalCustomerRevenueCents += o.totalCents;
        }
      }

      for (const addr of u.addresses) {
        if (addr.district) {
          const norm = addr.district.trim();
          districtCounts[norm] = (districtCounts[norm] || 0) + 1;
        }
      }
    }

    const customersWithoutOrders = Math.max(0, totalCustomers - customersWithOrders);

    const byDistrict = Object.entries(districtCounts)
      .map(([district, count]) => ({ district, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalCustomers,
      activeCustomers,
      inactiveCustomers,
      verifiedEmailCount,
      newCustomersLast30Days,
      customersWithOrders,
      customersWithoutOrders,
      totalCustomerRevenueCents,
      byDistrict,
    };
  }

  /**
   * Updates customer active status and creates an audit log entry.
   */
  async updateStatus(
    id: string,
    dto: UpdateCustomerStatusDto,
    actorId?: string | null
  ) {
    const customer = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    if (!customer || customer.role !== UserRole.CUSTOMER) {
      throw new NotFoundException(`Customer with ID "${id}" not found.`);
    }

    const previousStatus = customer.isActive;
    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: dto.isActive },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        updatedAt: true,
      },
    });

    // Record administrative action in audit log
    await this.auditService.recordAuditLog({
      action: 'CUSTOMER_STATUS_UPDATE',
      entityType: 'Customer',
      entityId: id,
      userId: actorId,
      summary: `Customer account "${customer.name}" (${customer.email}) status changed from ${
        previousStatus ? 'ACTIVE' : 'INACTIVE'
      } to ${dto.isActive ? 'ACTIVE' : 'INACTIVE'}${dto.reason ? ` - Reason: ${dto.reason}` : ''}`,
      changes: {
        isActive: { old: previousStatus, new: dto.isActive },
        reason: { old: null, new: dto.reason || null },
      },
    });

    return updated;
  }

  /**
   * Streams customers export in CSV or XLSX format using ExcelJS.
   */
  async exportCustomers(
    query: CustomerQueryDto,
    format: 'csv' | 'xlsx' = 'xlsx',
    selectedIds?: string[]
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const where: Prisma.UserWhereInput = {
      role: UserRole.CUSTOMER,
    };

    if (selectedIds && selectedIds.length > 0) {
      where.id = { in: selectedIds };
    } else {
      if (query.status === 'active') {
        where.isActive = true;
      } else if (query.status === 'inactive') {
        where.isActive = false;
      }

      const search = (query.search || query.q)?.trim();
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ];
      }
    }

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        isEmailVerified: true,
        createdAt: true,
        addresses: {
          select: { district: true, isDefault: true },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        },
        orders: {
          select: { totalCents: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Customers');

    worksheet.columns = [
      { header: 'Customer ID', key: 'id', width: 28 },
      { header: 'Full Name', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Phone', key: 'phone', width: 18 },
      { header: 'Primary District', key: 'district', width: 20 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Email Verified', key: 'emailVerified', width: 15 },
      { header: 'Registration Date', key: 'createdAt', width: 22 },
      { header: 'Total Orders', key: 'orderCount', width: 14 },
      { header: 'Total Spent (LKR)', key: 'totalSpent', width: 18 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };

    for (const u of users) {
      const orderCount = u.orders.length;
      const totalSpendLkr = (u.orders.reduce((sum, o) => sum + o.totalCents, 0) / 100).toFixed(2);
      const primaryDistrict = u.addresses[0]?.district || 'Not Set';

      worksheet.addRow({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone || 'N/A',
        district: primaryDistrict,
        status: u.isActive ? 'ACTIVE' : 'INACTIVE',
        emailVerified: u.isEmailVerified ? 'YES' : 'NO',
        createdAt: u.createdAt.toISOString().slice(0, 10),
        orderCount,
        totalSpent: totalSpendLkr,
      });
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `dsl-customers-${timestamp}.${format}`;
    let buffer: Buffer;
    let mimeType: string;

    if (format === 'csv') {
      const csvOutput = await workbook.csv.writeBuffer();
      buffer = Buffer.from(csvOutput);
      mimeType = 'text/csv';
    } else {
      const xlsxOutput = await workbook.xlsx.writeBuffer();
      buffer = Buffer.from(xlsxOutput);
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    return { buffer, filename, mimeType };
  }
}

