import { Prisma } from '@prisma/client';
import { BookQueryDto } from './books.dto';
export const relations = { author: true, publisher: true, genre: true } as const;
export function bookWhere(query: BookQueryDto): Prisma.BookWhereInput {
  const search = query.search?.trim();
  return {
    deletedAt: null,
    ...(query.authorId ? { authorId: query.authorId } : {}),
    ...(query.publisherId ? { publisherId: query.publisherId } : {}),
    ...(query.genreId ? { genreId: query.genreId } : {}),
    ...(query.available !== undefined ? { isAvailable: query.available === 'true' } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { author: { name: { contains: search, mode: 'insensitive' } } },
            { publisher: { name: { contains: search, mode: 'insensitive' } } },
          ] as Prisma.BookWhereInput[],
        }
      : {}),
  };
}
export function bookOrder(query: BookQueryDto): Prisma.BookOrderByWithRelationInput[] {
  const result: Prisma.BookOrderByWithRelationInput[] = query.sort.split(',').map((part) => {
    const [field, direction] = part.split(':');
    const order = direction as Prisma.SortOrder;
    return field === 'author' || field === 'publisher'
      ? { [field]: { name: order } }
      : { [field]: order };
  });
  return [...result, { id: 'asc' }];
}
export function csvCell(value: unknown) {
  const text = String(value ?? '');
  const safe = /^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text) ? "'" + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
}
