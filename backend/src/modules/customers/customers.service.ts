import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UserRole, Prisma, PaymentStatus, OrderStatus, RefundStatus } from '../../generated/prisma';
import { CustomerQueryDto, UpdateCustomerStatusDto } from './dto/customer-query.dto';
import * as ExcelJS from 'exceljs';

export type CustomerType = 'REGISTERED' | 'GUEST';

export interface CustomerListItem {
  id: string;
  customerType: CustomerType;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: Date;
  firstPurchaseDate: Date | null;
  lastPurchaseDate: Date | null;
  primaryDistrict: string | null;
  addressesCount: number;
  orderCount: number;
  paidOrderCount?: number;
  totalSpendCents: number;
  averageOrderValueCents?: number;
  associatedOrderNumbers?: string[];
}

export interface CustomerDetail {
  id: string;
  customerType: CustomerType;
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
    firstOrderDate: Date | null;
    lastOrderDate: Date | null;
  };
  wishlistCount: number;
  savedListsCount: number;
}

export interface CustomerAnalytics {
  totalCustomers: number;
  registeredCustomers: number;
  guestBuyers: number;
  activeCustomers: number;
  inactiveCustomers: number;
  verifiedEmailCount: number;
  newCustomersLast30Days: number;
  customersWithOrders: number;
  customersWithoutOrders: number;
  totalCustomerRevenueCents: number;
  averageOrderValueCents: number;
  byDistrict: Array<{ district: string; count: number }>;
}

/**
 * Normalizes email by trimming and converting to lowercase.
 */
export function normalizeEmail(email?: string | null): string {
  return (email || '').trim().toLowerCase();
}

/**
 * Normalizes phone numbers by stripping non-digit characters and standardizing local 07X to 947X.
 */
export function normalizePhone(phone?: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.startsWith('94') && digits.length === 11) return digits;
  if (digits.startsWith('0') && digits.length === 10) return '94' + digits.slice(1);
  return digits;
}

/**
 * Normalizes customer names for safe heuristic matching.
 */
export function normalizeName(name?: string | null): string {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Checks whether two names clearly conflict (belong to different individuals),
 * while tolerating substring variations (e.g., "Kamal" and "Kamal Silva").
 */
export function areNamesConflicting(name1?: string | null, name2?: string | null): boolean {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  if (!n1 || !n2) return false;
  if (n1 === n2) return false;
  // If one name is contained in the other, consider it a variation rather than conflict
  if (n1.includes(n2) || n2.includes(n1)) return false;
  return true;
}

/**
 * Escapes leading characters that could trigger CSV formula execution in spreadsheet applications.
 */
export function sanitizeCsvFormula(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/^[=+@-]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

interface GuestGroupInternal {
  groupKey: string;
  name: string;
  email: string;
  phone: string;
  primaryDistrict: string | null;
  addresses: Map<string, any>;
  orders: Array<{
    id: string;
    orderNumber: string;
    totalCents: number;
    paymentMethod: string;
    paymentStatus: string;
    orderStatus: string;
    createdAt: Date;
    itemsCount: number;
    shippingDistrict: string | null;
  }>;
  firstPurchaseDate: Date;
  lastPurchaseDate: Date;
  totalSpendCents: number;
}

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService
  ) { }

  /**
   * Safely groups guest orders into distinct guest buyer profiles based on normalized email and phone.
   */
  private groupGuestOrders(guestOrders: any[]): GuestGroupInternal[] {
    const groupsMap = new Map<string, GuestGroupInternal>();

    for (const ord of guestOrders) {
      const normEmail = normalizeEmail(ord.customerEmail);
      const normPhone = normalizePhone(ord.customerPhone);
      const rawName = ord.customerName || ord.addressSnapshot?.fullName || '';

      let groupKey: string;
      if (normEmail) {
        // If an existing group has this email but a completely different conflicting phone, keep distinct
        const candidateKey = `email:${normEmail}`;
        const existing = groupsMap.get(candidateKey);
        if (existing && existing.phone && normPhone && normalizePhone(existing.phone) !== normPhone) {
          groupKey = `email:${normEmail}|phone:${normPhone}`;
        } else if (existing && areNamesConflicting(existing.name, rawName)) {
          // Conflicting names sharing same email -> keep distinct to prevent silent conflation
          groupKey = `email:${normEmail}|name:${normalizeName(rawName)}`;
        } else {
          groupKey = candidateKey;
        }
      } else if (normPhone) {
        const candidateKey = `phone:${normPhone}`;
        const existing = groupsMap.get(candidateKey);
        if (existing && areNamesConflicting(existing.name, rawName)) {
          // Shared phone/landline with different names -> keep distinct
          groupKey = `phone:${normPhone}|name:${normalizeName(rawName)}`;
        } else {
          groupKey = candidateKey;
        }
      } else {
        groupKey = `order:${ord.id}`;
      }

      let group = groupsMap.get(groupKey);
      if (!group) {
        group = {
          groupKey,
          name: ord.customerName || ord.addressSnapshot?.fullName || 'Guest Buyer',
          email: ord.customerEmail || '',
          phone: ord.customerPhone || '',
          primaryDistrict: ord.addressSnapshot?.district || null,
          addresses: new Map(),
          orders: [],
          firstPurchaseDate: ord.createdAt,
          lastPurchaseDate: ord.createdAt,
          totalSpendCents: 0,
        };
        groupsMap.set(groupKey, group);
      }

      // Update dates and totals
      if (ord.createdAt < group.firstPurchaseDate) {
        group.firstPurchaseDate = ord.createdAt;
      }
      if (ord.createdAt > group.lastPurchaseDate) {
        group.lastPurchaseDate = ord.createdAt;
        // Prefer latest contact info and name
        if (ord.customerName && (!group.name || group.name === 'Guest Buyer' || ord.customerName.length >= group.name.length)) {
          group.name = ord.customerName;
        }
        if (ord.customerEmail) group.email = ord.customerEmail;
        if (ord.customerPhone) group.phone = ord.customerPhone;
        if (ord.addressSnapshot?.district) group.primaryDistrict = ord.addressSnapshot.district;
      }
      // Only count successfully paid orders towards purchase value, deducting any completed refunds
      const isPaid =
        ord.paymentStatus === PaymentStatus.PAID &&
        ord.orderStatus !== OrderStatus.CANCELLED;
      if (isPaid) {
        const refundTotal =
          ord.refundRecords?.reduce((sum: number, r: any) => sum + r.amountCents, 0) || 0;
        group.totalSpendCents += Math.max(0, ord.totalCents - refundTotal);
      }

      // Track address
      if (ord.addressSnapshot) {
        const addrKey = `${ord.addressSnapshot.addressLine1}_${ord.addressSnapshot.city}_${ord.addressSnapshot.district}`;
        if (!group.addresses.has(addrKey)) {
          group.addresses.set(addrKey, {
            id: ord.addressSnapshot.id,
            fullName: ord.addressSnapshot.fullName,
            phone: ord.addressSnapshot.phone,
            email: ord.addressSnapshot.email,
            addressLine1: ord.addressSnapshot.addressLine1,
            addressLine2: ord.addressSnapshot.addressLine2,
            city: ord.addressSnapshot.city,
            district: ord.addressSnapshot.district,
            postalCode: ord.addressSnapshot.postalCode,
            isDefault: group.addresses.size === 0,
            createdAt: ord.createdAt,
          });
        }
      }

      group.orders.push({
        id: ord.id,
        orderNumber: ord.orderNumber,
        totalCents: ord.totalCents,
        paymentMethod: ord.paymentMethod,
        paymentStatus: ord.paymentStatus,
        orderStatus: ord.orderStatus,
        createdAt: ord.createdAt,
        itemsCount: ord._count?.items ?? ord.items?.length ?? 0,
        shippingDistrict: ord.addressSnapshot?.district || null,
      });
    }

    return Array.from(groupsMap.values());
  }

  /**
   * Retrieves paginated customers with database multi-filtering supporting registered and guest customers.
   */
  async findAll(query: CustomerQueryDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(200, Math.max(1, query.limit || 25));
    const skip = (page - 1) * limit;

    const customerType = query.customerType || 'all';
    let combinedItems: CustomerListItem[] = [];

    // 1. Fetch Registered Customers if applicable
    if (customerType === 'all' || customerType === 'registered') {
      const userWhere: Prisma.UserWhereInput = {
        role: UserRole.CUSTOMER,
      };

      if (query.status === 'active') {
        userWhere.isActive = true;
      } else if (query.status === 'inactive') {
        userWhere.isActive = false;
      }

      const users = await this.prisma.user.findMany({
        where: userWhere,
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
              orderNumber: true,
              totalCents: true,
              paymentStatus: true,
              orderStatus: true,
              createdAt: true,
              refundRecords: {
                where: { status: RefundStatus.COMPLETED },
                select: { amountCents: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      const registeredItems: CustomerListItem[] = users.map((u) => {
        const orderCount = u.orders.length;
        let totalSpendCents = 0;
        let paidOrderCount = 0;
        for (const o of u.orders) {
          if (o.paymentStatus === PaymentStatus.PAID && o.orderStatus !== OrderStatus.CANCELLED) {
            paidOrderCount++;
            const refundTotal =
              (o as any).refundRecords?.reduce((sum: number, r: any) => sum + r.amountCents, 0) || 0;
            totalSpendCents += Math.max(0, o.totalCents - refundTotal);
          }
        }
        const averageOrderValueCents =
          paidOrderCount > 0 ? Math.round(totalSpendCents / paidOrderCount) : 0;
        const lastPurchaseDate = u.orders[0]?.createdAt || null;
        const firstPurchaseDate = u.orders[u.orders.length - 1]?.createdAt || null;
        const defaultAddr = u.addresses.find((a) => a.isDefault) || u.addresses[0];
        const primaryDistrict = defaultAddr ? defaultAddr.district : null;
        const associatedOrderNumbers = u.orders.map((o) => o.orderNumber);

        return {
          id: u.id,
          customerType: 'REGISTERED',
          name: u.name,
          email: u.email,
          phone: u.phone,
          isActive: u.isActive,
          isEmailVerified: u.isEmailVerified,
          createdAt: u.createdAt,
          firstPurchaseDate,
          lastPurchaseDate,
          primaryDistrict,
          addressesCount: u.addresses.length,
          orderCount,
          paidOrderCount,
          totalSpendCents,
          averageOrderValueCents,
          associatedOrderNumbers,
        };
      });

      combinedItems.push(...registeredItems);
    }

    // 2. Fetch Guest Customers if applicable (status=inactive excludes guests as guests are not suspended accounts)
    if ((customerType === 'all' || customerType === 'guest') && query.status !== 'inactive') {
      const guestWhere: Prisma.OrderWhereInput = {
        userId: null,
      };

      const rawSearch = (query.search || query.q)?.trim();
      if (rawSearch) {
        const cleanPhone = rawSearch.replace(/[^0-9]/g, '');
        const searchConditions: Prisma.OrderWhereInput[] = [
          { customerName: { contains: rawSearch, mode: 'insensitive' } },
          { customerEmail: { contains: rawSearch, mode: 'insensitive' } },
          { orderNumber: { contains: rawSearch, mode: 'insensitive' } },
        ];
        if (cleanPhone.length >= 4) {
          searchConditions.push({ customerPhone: { contains: cleanPhone } });
        }
        guestWhere.OR = searchConditions;
      }

      if (query.district && query.district.trim()) {
        guestWhere.addressSnapshot = {
          district: { contains: query.district.trim(), mode: 'insensitive' },
        };
      }

      if (query.startDate || query.endDate) {
        guestWhere.createdAt = {};
        if (query.startDate) guestWhere.createdAt.gte = new Date(query.startDate);
        if (query.endDate) {
          const end = new Date(query.endDate);
          end.setHours(23, 59, 59, 999);
          guestWhere.createdAt.lte = end;
        }
      }

      const guestOrders = await this.prisma.order.findMany({
        where: guestWhere,
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          customerEmail: true,
          customerPhone: true,
          totalCents: true,
          paymentMethod: true,
          paymentStatus: true,
          orderStatus: true,
          createdAt: true,
          refundRecords: {
            where: { status: RefundStatus.COMPLETED },
            select: { amountCents: true },
          },
          addressSnapshot: {
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
            },
          },
          _count: {
            select: { items: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const guestGroups = this.groupGuestOrders(guestOrders);
      const guestItems: CustomerListItem[] = guestGroups.map((g) => {
        const paidOrders = g.orders.filter(
          (o) => o.paymentStatus === PaymentStatus.PAID && o.orderStatus !== OrderStatus.CANCELLED
        );
        const paidOrderCount = paidOrders.length;
        const averageOrderValueCents =
          paidOrderCount > 0 ? Math.round(g.totalSpendCents / paidOrderCount) : 0;

        return {
          id: `guest:${encodeURIComponent(g.groupKey)}`,
          customerType: 'GUEST',
          name: g.name,
          email: g.email,
          phone: g.phone || null,
          isActive: true,
          isEmailVerified: false,
          createdAt: g.firstPurchaseDate,
          firstPurchaseDate: g.firstPurchaseDate,
          lastPurchaseDate: g.lastPurchaseDate,
          primaryDistrict: g.primaryDistrict,
          addressesCount: g.addresses.size,
          orderCount: g.orders.length,
          paidOrderCount,
          totalSpendCents: g.totalSpendCents,
          averageOrderValueCents,
          associatedOrderNumbers: g.orders.map((o) => o.orderNumber),
        };
      });

      combinedItems.push(...guestItems);
    }

    // 3. Apply Common In-Memory Filters across the combined list
    let filtered = combinedItems;

    // Search filter across name, email, phone, ID, or orderNumber
    const search = (query.search || query.q)?.trim().toLowerCase();
    if (search) {
      const cleanSearchPhone = search.replace(/[^0-9]/g, '');
      filtered = filtered.filter((c) => {
        const nameMatch = c.name.toLowerCase().includes(search);
        const emailMatch = c.email.toLowerCase().includes(search);
        const phoneMatch = c.phone
          ? c.phone.toLowerCase().includes(search) ||
          (cleanSearchPhone.length >= 4 &&
            c.phone.replace(/[^0-9]/g, '').includes(cleanSearchPhone))
          : false;
        const idMatch = c.id.toLowerCase().includes(search);
        const orderMatch = c.associatedOrderNumbers
          ? c.associatedOrderNumbers.some((num) => num.toLowerCase().includes(search))
          : false;
        return nameMatch || emailMatch || phoneMatch || idMatch || orderMatch;
      });
    }

    // Has orders filter
    if (query.hasOrders === 'with_orders') {
      filtered = filtered.filter((c) => c.orderCount > 0);
    } else if (query.hasOrders === 'no_orders') {
      filtered = filtered.filter((c) => c.orderCount === 0);
    }

    // District filter
    if (query.district && query.district.trim()) {
      const targetDist = query.district.trim().toLowerCase();
      filtered = filtered.filter(
        (c) => c.primaryDistrict && c.primaryDistrict.toLowerCase().includes(targetDist)
      );
    }

    // Registration / Creation Date Range filter
    if (query.startDate) {
      const start = new Date(query.startDate);
      if (!isNaN(start.getTime())) {
        filtered = filtered.filter((c) => c.createdAt >= start);
      }
    }
    if (query.endDate) {
      const end = new Date(query.endDate);
      if (!isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        filtered = filtered.filter((c) => c.createdAt <= end);
      }
    }

    // First purchase date filter
    if (query.firstPurchaseDate) {
      const fDate = new Date(query.firstPurchaseDate);
      if (!isNaN(fDate.getTime())) {
        filtered = filtered.filter((c) => c.firstPurchaseDate && c.firstPurchaseDate >= fDate);
      }
    }

    // Last purchase date filter
    if (query.lastPurchaseDate) {
      const lDate = new Date(query.lastPurchaseDate);
      if (!isNaN(lDate.getTime())) {
        lDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter((c) => c.lastPurchaseDate && c.lastPurchaseDate <= lDate);
      }
    }

    // Min / Max Order count filter
    if (query.minOrderCount !== undefined) {
      filtered = filtered.filter((c) => c.orderCount >= query.minOrderCount!);
    }
    if (query.maxOrderCount !== undefined) {
      filtered = filtered.filter((c) => c.orderCount <= query.maxOrderCount!);
    }

    // Min / Max Spend filter (in cents)
    if (query.minSpendCents !== undefined) {
      filtered = filtered.filter((c) => c.totalSpendCents >= query.minSpendCents!);
    }
    if (query.maxSpendCents !== undefined) {
      filtered = filtered.filter((c) => c.totalSpendCents <= query.maxSpendCents!);
    }

    // 4. Stable Sorting
    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    filtered.sort((a, b) => {
      let valA: any;
      let valB: any;

      switch (sortField) {
        case 'name':
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
          break;
        case 'email':
          valA = a.email.toLowerCase();
          valB = b.email.toLowerCase();
          break;
        case 'orderCount':
          valA = a.orderCount;
          valB = b.orderCount;
          break;
        case 'totalSpendCents':
          valA = a.totalSpendCents;
          valB = b.totalSpendCents;
          break;
        case 'firstPurchaseDate':
          valA = a.firstPurchaseDate ? a.firstPurchaseDate.getTime() : 0;
          valB = b.firstPurchaseDate ? b.firstPurchaseDate.getTime() : 0;
          break;
        case 'lastPurchaseDate':
          valA = a.lastPurchaseDate ? a.lastPurchaseDate.getTime() : 0;
          valB = b.lastPurchaseDate ? b.lastPurchaseDate.getTime() : 0;
          break;
        case 'createdAt':
        default:
          valA = a.createdAt.getTime();
          valB = b.createdAt.getTime();
          break;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      // Stable secondary tie-breaker
      return a.id.localeCompare(b.id);
    });

    const total = filtered.length;
    const paginatedItems = filtered.slice(skip, skip + limit);

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
   * Supports both Registered Customers (User ID) and Guest Customers (guest: identifier).
   */
  async findById(id: string): Promise<CustomerDetail> {
    // 1. Handle Guest Customer Profile
    if (id.startsWith('guest:')) {
      const rawKey = decodeURIComponent(id.slice(6));

      const guestWhere: Prisma.OrderWhereInput = { userId: null };
      if (rawKey.startsWith('email:')) {
        const parts = rawKey.split('|');
        const emailPart = parts[0].replace(/^email:/, '');
        guestWhere.customerEmail = { equals: emailPart, mode: 'insensitive' };
      } else if (rawKey.startsWith('phone:')) {
        const phonePart = rawKey.replace(/^phone:/, '');
        guestWhere.customerPhone = { contains: phonePart };
      } else if (rawKey.startsWith('order:')) {
        const orderId = rawKey.replace(/^order:/, '');
        guestWhere.id = orderId;
      }

      const guestOrders = await this.prisma.order.findMany({
        where: guestWhere,
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          customerEmail: true,
          customerPhone: true,
          totalCents: true,
          paymentMethod: true,
          paymentStatus: true,
          orderStatus: true,
          createdAt: true,
          refundRecords: {
            where: { status: RefundStatus.COMPLETED },
            select: { amountCents: true },
          },
          addressSnapshot: {
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
            },
          },
          _count: {
            select: { items: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const groups = this.groupGuestOrders(guestOrders);
      const matchedGroup = groups.find((g) => g.groupKey === rawKey);

      if (!matchedGroup) {
        throw new NotFoundException(`Guest buyer with ID "${id}" not found.`);
      }

      const totalOrders = matchedGroup.orders.length;
      const totalSpendCents = matchedGroup.totalSpendCents;
      const paidOrders = matchedGroup.orders.filter(
        (o) => o.paymentStatus === PaymentStatus.PAID && o.orderStatus !== OrderStatus.CANCELLED
      );
      const paidOrdersCount = paidOrders.length;
      const averageOrderValueCents =
        paidOrdersCount > 0 ? Math.round(totalSpendCents / paidOrdersCount) : 0;

      return {
        id,
        customerType: 'GUEST',
        name: matchedGroup.name,
        email: matchedGroup.email,
        phone: matchedGroup.phone || null,
        isActive: true,
        isEmailVerified: false,
        createdAt: matchedGroup.firstPurchaseDate,
        updatedAt: matchedGroup.lastPurchaseDate,
        addresses: Array.from(matchedGroup.addresses.values()),
        orders: matchedGroup.orders,
        orderSummary: {
          totalOrders,
          totalSpendCents,
          averageOrderValueCents,
          firstOrderDate: matchedGroup.firstPurchaseDate,
          lastOrderDate: matchedGroup.lastPurchaseDate,
        },
        wishlistCount: 0,
        savedListsCount: 0,
      };
    }

    // 2. Handle Registered Customer Profile
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

    // Find all orders linked via userId
    const orders = await this.prisma.order.findMany({
      where: {
        userId: user.id,
      },
      select: {
        id: true,
        orderNumber: true,
        totalCents: true,
        paymentMethod: true,
        paymentStatus: true,
        orderStatus: true,
        createdAt: true,
        refundRecords: {
          where: { status: RefundStatus.COMPLETED },
          select: { amountCents: true },
        },
        _count: {
          select: { items: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalOrders = orders.length;
    let totalSpendCents = 0;
    let paidOrdersCount = 0;
    for (const o of orders) {
      if (o.paymentStatus === PaymentStatus.PAID && o.orderStatus !== OrderStatus.CANCELLED) {
        paidOrdersCount++;
        const refundTotal =
          (o as any).refundRecords?.reduce((sum: number, r: any) => sum + r.amountCents, 0) || 0;
        totalSpendCents += Math.max(0, o.totalCents - refundTotal);
      }
    }
    const averageOrderValueCents =
      paidOrdersCount > 0 ? Math.round(totalSpendCents / paidOrdersCount) : 0;
    const lastOrderDate = orders[0]?.createdAt || null;
    const firstOrderDate = orders[orders.length - 1]?.createdAt || null;

    return {
      id: user.id,
      customerType: 'REGISTERED',
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
        firstOrderDate,
        lastOrderDate,
      },
      wishlistCount: user._count.wishlist,
      savedListsCount: user._count.savedLists + user._count.savedStationeryLists,
    };
  }

  /**
   * Generates real database customer analytics and distribution metrics across registered and guest customers.
   */
  async getAnalytics(): Promise<CustomerAnalytics> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      registeredCustomers,
      activeRegistered,
      inactiveCustomers,
      verifiedEmailCount,
      newRegisteredLast30Days,
      registeredUsers,
      guestOrders,
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
          addresses: { select: { district: true } },
          orders: {
            select: {
              totalCents: true,
              paymentStatus: true,
              orderStatus: true,
              refundRecords: {
                where: { status: RefundStatus.COMPLETED },
                select: { amountCents: true },
              },
            },
          },
        },
      }),
      this.prisma.order.findMany({
        where: { userId: null },
        select: {
          id: true,
          orderNumber: true,
          customerEmail: true,
          customerPhone: true,
          customerName: true,
          totalCents: true,
          paymentMethod: true,
          paymentStatus: true,
          orderStatus: true,
          createdAt: true,
          addressSnapshot: { select: { district: true } },
          refundRecords: {
            where: { status: RefundStatus.COMPLETED },
            select: { amountCents: true },
          },
        },
      }),
    ]);

    // Group guest buyers
    const guestGroups = this.groupGuestOrders(guestOrders);
    const guestBuyers = guestGroups.length;

    let newGuestBuyersLast30Days = 0;
    for (const g of guestGroups) {
      if (g.firstPurchaseDate >= thirtyDaysAgo) {
        newGuestBuyersLast30Days++;
      }
    }

    let registeredWithOrders = 0;
    let totalCustomerRevenueCents = 0;
    let totalPaidOrdersCount = 0;
    const districtCounts: Record<string, number> = {};

    // Process registered users metrics
    for (const u of registeredUsers) {
      if (u.orders.length > 0) {
        registeredWithOrders++;
        for (const o of u.orders) {
          if (o.paymentStatus === PaymentStatus.PAID && o.orderStatus !== OrderStatus.CANCELLED) {
            totalPaidOrdersCount++;
            const refundTotal = (o as any).refundRecords?.reduce((sum: number, r: any) => sum + r.amountCents, 0) || 0;
            totalCustomerRevenueCents += Math.max(0, o.totalCents - refundTotal);
          }
        }
      }

      for (const addr of u.addresses) {
        if (addr.district) {
          const norm = addr.district.trim();
          districtCounts[norm] = (districtCounts[norm] || 0) + 1;
        }
      }
    }

    // Process guest buyers metrics
    for (const g of guestGroups) {
      totalCustomerRevenueCents += g.totalSpendCents;
      totalPaidOrdersCount += g.orders.filter(
        (o) => o.paymentStatus === PaymentStatus.PAID && o.orderStatus !== OrderStatus.CANCELLED
      ).length;
      if (g.primaryDistrict) {
        const norm = g.primaryDistrict.trim();
        districtCounts[norm] = (districtCounts[norm] || 0) + 1;
      }
    }

    const averageOrderValueCents =
      totalPaidOrdersCount > 0
        ? Math.round(totalCustomerRevenueCents / totalPaidOrdersCount)
        : 0;

    const totalCustomers = registeredCustomers + guestBuyers;
    const activeCustomers = activeRegistered + guestBuyers; // guests are considered active buyers
    const newCustomersLast30Days = newRegisteredLast30Days + newGuestBuyersLast30Days;
    // Guest buyers by definition have at least one order
    const customersWithOrders = registeredWithOrders + guestBuyers;
    const customersWithoutOrders = Math.max(0, registeredCustomers - registeredWithOrders);

    const byDistrict = Object.entries(districtCounts)
      .map(([district, count]) => ({ district, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalCustomers,
      registeredCustomers,
      guestBuyers,
      activeCustomers,
      inactiveCustomers,
      verifiedEmailCount,
      newCustomersLast30Days,
      customersWithOrders,
      customersWithoutOrders,
      totalCustomerRevenueCents,
      averageOrderValueCents,
      byDistrict,
    };
  }

  /**
   * Updates customer active status and creates an audit log entry.
   * Only applicable to Registered Customers.
   */
  async updateStatus(
    id: string,
    dto: UpdateCustomerStatusDto,
    actorId?: string | null
  ) {
    if (id.startsWith('guest:')) {
      throw new BadRequestException('Guest buyers do not have user accounts and cannot be activated or suspended.');
    }

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
      summary: `Customer account "${customer.name}" (${customer.email}) status changed from ${previousStatus ? 'ACTIVE' : 'INACTIVE'
        } to ${dto.isActive ? 'ACTIVE' : 'INACTIVE'}${dto.reason ? ` - Reason: ${dto.reason}` : ''}`,
      changes: {
        isActive: { old: previousStatus, new: dto.isActive },
        reason: { old: null, new: dto.reason || null },
      },
    });

    return updated;
  }

  /**
   * Streams customers export in CSV or XLSX format using ExcelJS with CSV formula injection sanitization.
   */
  async exportCustomers(
    query: CustomerQueryDto,
    format: 'csv' | 'xlsx' = 'xlsx',
    selectedIds?: string[]
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    // If selected IDs provided, query all without limit and filter
    const exportQuery = { ...query, page: 1, limit: 10000 };
    const result = await this.findAll(exportQuery);
    let itemsToExport = result.items;

    if (selectedIds && selectedIds.length > 0) {
      const idSet = new Set(selectedIds);
      itemsToExport = itemsToExport.filter((item) => idSet.has(item.id));
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Customers');

    worksheet.columns = [
      { header: 'Customer ID', key: 'id', width: 28 },
      { header: 'Type', key: 'customerType', width: 14 },
      { header: 'Full Name', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Phone', key: 'phone', width: 18 },
      { header: 'Primary District', key: 'district', width: 20 },
      { header: 'Account Status', key: 'status', width: 14 },
      { header: 'Email Verified', key: 'emailVerified', width: 15 },
      { header: 'Registration Date', key: 'createdAt', width: 20 },
      { header: 'First Purchase', key: 'firstPurchase', width: 20 },
      { header: 'Last Purchase', key: 'lastPurchase', width: 20 },
      { header: 'Total Orders', key: 'orderCount', width: 14 },
      { header: 'Total Spent (LKR)', key: 'totalSpent', width: 18 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };

    for (const c of itemsToExport) {
      const totalSpendLkr = (c.totalSpendCents / 100).toFixed(2);
      const isGuest = c.customerType === 'GUEST';

      const rowValues = {
        id: format === 'csv' ? sanitizeCsvFormula(c.id) : c.id,
        customerType: c.customerType,
        name: format === 'csv' ? sanitizeCsvFormula(c.name) : c.name,
        email: format === 'csv' ? sanitizeCsvFormula(c.email) : c.email,
        phone: format === 'csv' ? sanitizeCsvFormula(c.phone || 'N/A') : c.phone || 'N/A',
        district: format === 'csv' ? sanitizeCsvFormula(c.primaryDistrict || 'Not Set') : c.primaryDistrict || 'Not Set',
        status: isGuest ? 'N/A' : c.isActive ? 'ACTIVE' : 'INACTIVE',
        emailVerified: isGuest ? 'N/A' : c.isEmailVerified ? 'YES' : 'NO',
        createdAt: isGuest ? 'N/A' : c.createdAt.toISOString().slice(0, 10),
        firstPurchase: c.firstPurchaseDate ? c.firstPurchaseDate.toISOString().slice(0, 10) : 'None',
        lastPurchase: c.lastPurchaseDate ? c.lastPurchaseDate.toISOString().slice(0, 10) : 'None',
        orderCount: c.orderCount,
        totalSpent: totalSpendLkr,
      };

      worksheet.addRow(rowValues);
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
