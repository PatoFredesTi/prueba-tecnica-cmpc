import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ImageStoragePort } from '../files/image-storage';
import { RequestContext } from '../common/http';
import { BookQueryDto, CreateBookDto, UpdateBookDto } from './books.dto';
import { bookWhere, bookOrder, csvCell, relations } from './query';
@Injectable()
export class BooksService {
  private logger = new Logger('Books');
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private storage: ImageStoragePort,
  ) {}
  async list(query: BookQueryDto) {
    const where = bookWhere(query);
    const [data, total] = await this.prisma.$transaction(
      [
        this.prisma.book.findMany({
          where,
          include: relations,
          orderBy: bookOrder(query),
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        this.prisma.book.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return {
      data,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }
  async find(id: string, tx: Prisma.TransactionClient = this.prisma) {
    const book = await tx.book.findFirst({ where: { id, deletedAt: null }, include: relations });
    if (!book) throw new NotFoundException('Libro no encontrado');
    return book;
  }
  private async catalogs(tx: Prisma.TransactionClient, dto: UpdateBookDto) {
    const ids: { authorId?: string; publisherId?: string; genreId?: string } = {};
    // Cada upsert usa el índice único normalizado y participa de la transacción del libro.
    for (const key of ['author', 'publisher', 'genre'] as const) {
      const name = dto[key];
      if (name === undefined) continue;
      const normalizedName = name
        .normalize('NFKC')
        .trim()
        .replace(/\s+/g, ' ')
        .toLocaleLowerCase('es');
      const args = { where: { normalizedName }, create: { name, normalizedName }, update: {} };
      const catalog =
        key === 'author'
          ? await tx.author.upsert(args)
          : key === 'publisher'
            ? await tx.publisher.upsert(args)
            : await tx.genre.upsert(args);
      ids[`${key}Id`] = catalog.id;
    }
    return ids;
  }
  async create(dto: CreateBookDto, ctx: RequestContext) {
    return this.prisma.$transaction(async (tx) => {
      const ids = await this.catalogs(tx, dto);
      const book = await tx.book.create({
        data: {
          title: dto.title,
          price: dto.price,
          isAvailable: dto.isAvailable,
          authorId: ids.authorId!,
          publisherId: ids.publisherId!,
          genreId: ids.genreId!,
        },
        include: relations,
      });
      await this.audit.record(tx, ctx, 'CREATE', book.id, undefined, book);
      return book;
    });
  }
  async update(id: string, dto: UpdateBookDto, ctx: RequestContext) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.find(id, tx),
        ids = await this.catalogs(tx, dto);
      const book = await tx.book.update({
        where: { id, deletedAt: null },
        data: { title: dto.title, price: dto.price, isAvailable: dto.isAvailable, ...ids },
        include: relations,
      });
      await this.audit.record(tx, ctx, 'UPDATE', id, before, book);
      return book;
    });
  }
  async remove(id: string, ctx: RequestContext) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.find(id, tx);
      const book = await tx.book.update({
        where: { id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      await this.audit.record(tx, ctx, 'DELETE', id, before, book);
      return { id, deleted: true };
    });
  }
  async upload(id: string, file: Express.Multer.File, ctx: RequestContext) {
    await this.find(id);
    const url = await this.storage.save(file);
    let previous: string | null = null;
    let book;
    try {
      book = await this.prisma.$transaction(async (tx) => {
        const before = await this.find(id, tx);
        previous = before.imageUrl;
        const after = await tx.book.update({
          where: { id, deletedAt: null },
          data: { imageUrl: url },
          include: relations,
        });
        await this.audit.record(tx, ctx, 'IMAGE_UPDATE', id, before, after);
        return after;
      });
    } catch (error) {
      await this.storage
        .remove(url)
        .catch(() => this.logger.error('No se pudo limpiar una imagen huérfana'));
      throw error;
    }
    if (previous)
      await this.storage
        .remove(previous)
        .catch(() => this.logger.warn('No se pudo eliminar la imagen anterior'));
    return book;
  }
  async *exportCsv(query: BookQueryDto): AsyncGenerator<string> {
    yield '\uFEFF' +
      ['Título', 'Autor', 'Editorial', 'Género', 'Precio CLP', 'Disponibilidad']
        .map(csvCell)
        .join(',') +
      '\r\n';
    let skip = 0;
    while (true) {
      const books = await this.prisma.book.findMany({
        where: bookWhere(query),
        orderBy: bookOrder(query),
        include: relations,
        skip,
        take: 500,
      });
      for (const b of books)
        yield [
          b.title,
          b.author.name,
          b.publisher.name,
          b.genre.name,
          b.price.toFixed(2),
          b.isAvailable ? 'Disponible' : 'No disponible',
        ]
          .map(csvCell)
          .join(',') + '\r\n';
      if (books.length < 500) break;
      skip += books.length;
    }
  }
}
