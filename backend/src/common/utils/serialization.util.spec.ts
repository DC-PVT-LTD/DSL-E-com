import { describe, it, expect } from 'vitest';
import {
  excludeSensitiveFields,
  excludeSensitiveFieldsMany,
  normalizePrismaValues,
} from './serialization.util';

describe('Serialization Utilities', () => {
  it('excludes sensitive fields from a single record', () => {
    const user = {
      id: 'usr_1',
      name: 'Nimal Perera',
      email: 'nimal@example.com',
      passwordHash: 'argon2id$hashedpassword123',
      resetToken: 'secret_token_abc',
    };

    const sanitized = excludeSensitiveFields(user, [
      'passwordHash',
      'resetToken',
    ]);

    expect(sanitized).toEqual({
      id: 'usr_1',
      name: 'Nimal Perera',
      email: 'nimal@example.com',
    });
    expect((sanitized as any).passwordHash).toBeUndefined();
    expect((sanitized as any).resetToken).toBeUndefined();
  });

  it('excludes sensitive fields from an array of records', () => {
    const users = [
      { id: '1', name: 'User 1', passwordHash: 'hash1' },
      { id: '2', name: 'User 2', passwordHash: 'hash2' },
    ];

    const sanitized = excludeSensitiveFieldsMany(users, ['passwordHash']);

    expect(sanitized).toHaveLength(2);
    expect((sanitized[0] as any).passwordHash).toBeUndefined();
    expect((sanitized[1] as any).passwordHash).toBeUndefined();
    expect(sanitized[0].name).toBe('User 1');
  });

  it('normalizes BigInt and Prisma Decimal-like objects to native numbers', () => {
    const input = {
      count: BigInt(42),
      price: {
        toNumber: () => 149.99,
      },
      createdAt: new Date('2026-10-28T12:00:00Z'),
      title: 'Doms Colour Pencils',
      nested: {
        total: BigInt(100),
      },
    };

    const result = normalizePrismaValues(input);

    expect(result.count).toBe(42);
    expect(result.price).toBe(149.99);
    expect(result.title).toBe('Doms Colour Pencils');
    expect(result.nested.total).toBe(100);
    expect(result.createdAt).toBeInstanceOf(Date);
  });
});
