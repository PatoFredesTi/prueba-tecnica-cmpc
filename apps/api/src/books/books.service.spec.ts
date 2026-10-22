import { BooksService } from './books.service';
import { BookQueryDto } from './books.dto';
import { Prisma } from '@prisma/client';
const ctx = { actorId: 'user', requestId: 'request' };
const dto = {
  title: 'Libro',
  author: 'Autor',
  publisher: 'Editorial',
  genre: 'Género',
  price: '100.00',
  isAvailable: true,
};
const book = {
  id: 'book',
  ...dto,
  author: { id: 'a', name: 'Autor' },
  publisher: { id: 'p', name: 'Editorial' },
  genre: { id: 'g', name: 'Género' },
  price: new Prisma.Decimal(100),
  imageUrl: '/uploads/old.webp',
  deletedAt: null,
};
describe('BooksService', () => {
  let service: BooksService, db: any, audit: any, storage: any;
  beforeEach(() => {
    db = {
      book: {
        findMany: jest.fn().mockResolvedValue([book]),
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn().mockResolvedValue(book),
        create: jest.fn().mockResolvedValue(book),
        update: jest.fn().mockResolvedValue(book),
      },
      author: { upsert: jest.fn().mockResolvedValue({ id: 'a' }) },
      publisher: { upsert: jest.fn().mockResolvedValue({ id: 'p' }) },
      genre: { upsert: jest.fn().mockResolvedValue({ id: 'g' }) },
    };
    db.$transaction = jest.fn((arg: any) =>
      typeof arg === 'function' ? arg(db) : Promise.all(arg),
    );
    audit = { record: jest.fn().mockResolvedValue({}) };
    storage = {
      save: jest.fn().mockResolvedValue('/uploads/new.webp'),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    service = new BooksService(db, audit, storage);
  });
  it('pagina con filtros aplicados antes de contar', async () => {
    const q = Object.assign(new BookQueryDto(), { page: 2, pageSize: 5, available: 'true' });
    expect(await service.list(q)).toMatchObject({
      data: [book],
      meta: { page: 2, pageSize: 5, total: 1, totalPages: 1 },
    });
    expect(db.book.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5, where: { deletedAt: null, isAvailable: true } }),
    );
    expect(db.book.count).toHaveBeenCalledWith({ where: { deletedAt: null, isAvailable: true } });
  });
  it('crea catálogos normalizados, libro y auditoría en una transacción', async () => {
    await service.create({ ...dto, author: '  AUTOR  ' }, ctx);
    expect(db.author.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { normalizedName: 'autor' } }),
    );
    expect(db.book.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ authorId: 'a', publisherId: 'p', genreId: 'g' }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(db, ctx, 'CREATE', 'book', undefined, book);
  });
  it('edita sin recrear catálogos omitidos', async () => {
    await service.update('book', { price: '200' }, ctx);
    expect(db.author.upsert).not.toHaveBeenCalled();
    expect(db.book.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'book', deletedAt: null },
        data: expect.objectContaining({ price: '200' }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(db, ctx, 'UPDATE', 'book', book, book);
  });
  it('retira lógicamente y audita con contexto', async () => {
    expect(await service.remove('book', ctx)).toEqual({ id: 'book', deleted: true });
    expect(db.book.update).toHaveBeenCalledWith({
      where: { id: 'book', deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
    expect(audit.record).toHaveBeenCalledWith(db, ctx, 'DELETE', 'book', book, book);
  });
  it('no permite leer/editar/retirar un libro inexistente o eliminado', async () => {
    db.book.findFirst.mockResolvedValue(null);
    await expect(service.find('missing')).rejects.toThrow('Libro no encontrado');
    await expect(service.update('missing', {}, ctx)).rejects.toThrow();
    await expect(service.remove('missing', ctx)).rejects.toThrow();
    expect(db.book.update).not.toHaveBeenCalled();
  });
  it('propaga fallo de auditoría para revertir la transacción', async () => {
    audit.record.mockRejectedValue(new Error('audit unavailable'));
    await expect(service.create(dto, ctx)).rejects.toThrow('audit unavailable');
  });
  it('reemplaza imagen y elimina anterior después de persistir', async () => {
    await service.upload('book', {} as any, ctx);
    expect(storage.remove).toHaveBeenCalledWith('/uploads/old.webp');
    expect(audit.record).toHaveBeenCalledWith(db, ctx, 'IMAGE_UPDATE', 'book', book, book);
  });
  it('limpia imagen nueva si falla la transacción', async () => {
    audit.record.mockRejectedValue(new Error('fail'));
    await expect(service.upload('book', {} as any, ctx)).rejects.toThrow('fail');
    expect(storage.remove).toHaveBeenCalledWith('/uploads/new.webp');
    expect(storage.remove).not.toHaveBeenCalledWith('/uploads/old.webp');
  });
  it('tolera error al limpiar portada anterior sin revertir el libro', async () => {
    storage.remove.mockRejectedValue(new Error('io'));
    await expect(service.upload('book', {} as any, ctx)).resolves.toEqual(book);
  });
  it('exporta todos los resultados sin usar la página visible', async () => {
    const q = Object.assign(new BookQueryDto(), { page: 99, available: 'true' });
    let csv = '';
    for await (const chunk of service.exportCsv(q)) csv += chunk;
    expect(csv).toContain('Título');
    expect(csv).toContain('"100.00","Disponible"');
    expect(db.book.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 500,
        where: { deletedAt: null, isAvailable: true },
      }),
    );
  });
  it('exporta por lotes y representa disponibilidad falsa', async () => {
    db.book.findMany
      .mockResolvedValueOnce(Array.from({ length: 500 }, () => ({ ...book, isAvailable: false })))
      .mockResolvedValueOnce([]);
    let rows = 0;
    for await (const _ of service.exportCsv(new BookQueryDto())) rows++;
    expect(rows).toBe(501);
    expect(db.book.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 500 }));
  });
});
