import { BadRequestException, HttpException, StreamableFile } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { firstValueFrom, of } from 'rxjs';
import { ApiExceptionFilter, ResponseInterceptor, context, requestId } from './http';
import { AuditService } from '../audit/audit.service';
import { HealthController } from '../health/health.controller';
import { CatalogsController } from '../catalogs/catalogs.controller';
import { BooksController } from '../books/books.controller';
import { BookQueryDto } from '../books/books.dto';
describe('Infraestructura HTTP', () => {
  const req: any = { requestId: 'r', user: { sub: 'u' }, method: 'GET', path: '/books' };
  const execution: any = { switchToHttp: () => ({ getRequest: () => req }) };
  it('genera correlación propia y extrae actor', () => {
    const res = { setHeader: jest.fn() },
      next = jest.fn(),
      input: any = {};
    requestId(input, res as any, next);
    expect(input.requestId).toMatch(/^[a-f0-9-]{36}$/);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', input.requestId);
    expect(next).toHaveBeenCalled();
    expect(context(req)).toEqual({ actorId: 'u', requestId: 'r' });
  });
  it('envuelve JSON y preserva metadata de páginas y streams', async () => {
    const interceptor = new ResponseInterceptor();
    expect(
      await firstValueFrom(interceptor.intercept(execution, { handle: () => of({ id: 1 }) })),
    ).toEqual({ data: { id: 1 }, meta: { requestId: 'r' } });
    const page = { data: [], meta: { page: 1 } },
      file = new StreamableFile(Buffer.from('csv'));
    for (const value of [page, file])
      expect(
        await firstValueFrom(interceptor.intercept(execution, { handle: () => of(value) })),
      ).toBe(value);
  });
  it.each([
    [new BadRequestException(['price inválido']), 400, 'VALIDATION_ERROR'],
    [new HttpException('No autorizado', 401), 401, 'UNAUTHORIZED'],
    [new Error('secret'), 500, 'INTERNAL_ERROR'],
    [
      new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: '6' }),
      409,
      'CONFLICT',
    ],
    [
      new Prisma.PrismaClientKnownRequestError('missing', { code: 'P2025', clientVersion: '6' }),
      404,
      'NOT_FOUND',
    ],
    [
      new Prisma.PrismaClientKnownRequestError('fk', { code: 'P2003', clientVersion: '6' }),
      400,
      'VALIDATION_ERROR',
    ],
  ])('uniforma errores sin filtrar secretos', (error, status, code) => {
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    new ApiExceptionFilter().catch(error, {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as any);
    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: status, code, requestId: 'r' }),
    );
    expect(JSON.stringify(res.json.mock.calls)).not.toContain('secret');
  });
  it('termina una respuesta de streaming que ya envió headers', () => {
    const res = { headersSent: true, end: jest.fn() };
    new ApiExceptionFilter().catch(new Error(), {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as any);
    expect(res.end).toHaveBeenCalled();
  });
  it('serializa snapshots y decimales para auditoría', async () => {
    const tx: any = { auditLog: { create: jest.fn() } };
    await new AuditService().record(tx, context(req), 'UPDATE', 'b', undefined, {
      price: new Prisma.Decimal('1.25'),
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ after: { price: '1.25' }, before: undefined }),
    });
  });
  it('health comprueba BD y responde fallo controlado', async () => {
    const db: any = { $queryRaw: jest.fn().mockResolvedValue([]) },
      health = new HealthController(db);
    expect(await health.check()).toEqual({ status: 'ok', database: 'connected' });
    db.$queryRaw.mockRejectedValue(new Error());
    await expect(health.check()).rejects.toThrow('Base de datos no disponible');
  });
  it('catálogos ordenan opciones', async () => {
    const query = { findMany: jest.fn() },
      catalogs = new CatalogsController({ author: query, publisher: query, genre: query } as any);
    catalogs.authors();
    catalogs.publishers();
    catalogs.genres();
    expect(query.findMany).toHaveBeenCalledTimes(3);
    expect(query.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } });
  });
  it('controlador de libros delega, exporta stream y propaga contexto', () => {
    const service: any = {
        list: jest.fn(),
        find: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
        upload: jest.fn(),
        exportCsv: jest.fn().mockReturnValue(['csv']),
      },
      c = new BooksController(service),
      q = new BookQueryDto();
    c.list(q);
    c.find('id');
    c.create({} as any, req);
    c.update('id', {}, req);
    c.remove('id', req);
    c.upload('id', {} as any, req);
    expect(c.export(q)).toBeInstanceOf(StreamableFile);
    expect(service.remove).toHaveBeenCalledWith('id', context(req));
    expect(service.upload).toHaveBeenCalledWith('id', {}, context(req));
  });
});
