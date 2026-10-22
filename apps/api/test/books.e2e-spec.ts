import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { AppModule } from '../src/app.module';
import { setup } from '../src/setup';
import { hash } from 'bcryptjs';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { BooksService } from '../src/books/books.service';
const suite = process.env.DATABASE_URL ? describe : describe.skip;
suite('Integración real · PostgreSQL + HTTP', () => {
  let app: INestApplication,
    db: PrismaService,
    token: string,
    id: string,
    userId: string,
    uploads: string;
  const prefix = `Integration-${randomUUID()}`,
    email = `${prefix}@test.local`.toLowerCase();
  const dto = {
    title: prefix,
    author: prefix,
    publisher: prefix,
    genre: prefix,
    price: '12500.50',
    isAvailable: true,
  };
  beforeAll(async () => {
    process.env.JWT_SECRET = 'integration-test-only-secret-at-least-32-characters';
    uploads = await mkdtemp(join(tmpdir(), 'cmpc-integration-'));
    process.env.UPLOAD_DIR = uploads;
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    setup(app);
    await app.init();
    db = app.get(PrismaService);
    const user = await db.user.create({
      data: { email, passwordHash: await hash('Integration123!', 4) },
    });
    userId = user.id;
  });
  afterAll(async () => {
    if (db) {
      await db.auditLog.deleteMany({
        where: { OR: [{ actorId: userId }, { entityId: id || 'none' }] },
      });
      await db.book.deleteMany({ where: { title: { startsWith: prefix } } });
      for (const delegate of [db.author, db.publisher, db.genre])
        await (delegate as any).deleteMany({ where: { name: prefix } });
      await db.user.delete({ where: { id: userId } });
    }
    await app?.close();
    if (uploads) await rm(uploads, { recursive: true, force: true });
  });
  it('protege el catálogo y devuelve error correlacionado', async () => {
    const r = await request(app.getHttpServer()).get('/api/v1/books').expect(401);
    expect(r.body).toMatchObject({ code: 'UNAUTHORIZED', requestId: expect.any(String) });
  });
  it('login entrega token y registra auditoría sin secretos', async () => {
    const r = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Session-Request', '1')
      .send({ email, password: 'Integration123!' })
      .expect(200);
    token = r.body.data.accessToken;
    expect(token).toBeTruthy();
    const log = await db.auditLog.findFirst({ where: { actorId: userId, action: 'LOGIN' } });
    expect(log?.requestId).toBeTruthy();
    expect(JSON.stringify(log)).not.toContain('password');
  });
  it('restaura con cookie HttpOnly, conserva su vencimiento y revoca al cerrar sesión', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Session-Request', '1')
      .send({ email, password: 'Integration123!' })
      .expect(200);
    const cookie = login.headers['set-cookie'][0];
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/api/v1/auth');
    expect(login.body.data.refreshToken).toBeUndefined();
    expect(login.headers['cache-control']).toBe('no-store');
    const raw = cookie.split(';')[0].split('=')[1];
    expect(await db.authSession.count({ where: { tokenHash: raw } })).toBe(0);
    for (let i = 0; i < 2; i++) {
      const restored = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('X-Session-Request', '1')
        .set('Cookie', cookie)
        .expect(200);
      expect(restored.body.data.user.email).toBe(email);
      expect(restored.headers['set-cookie']).toBeUndefined();
      await request(app.getHttpServer())
        .get('/api/v1/books')
        .auth(restored.body.data.accessToken, { type: 'bearer' })
        .expect(200);
    }
    const logout = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('X-Session-Request', '1')
      .set('Cookie', cookie)
      .expect(200);
    expect(logout.headers['set-cookie'][0]).toContain('Expires=Thu, 01 Jan 1970');
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('X-Session-Request', '1')
      .set('Cookie', cookie)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('X-Session-Request', '1')
      .set('Cookie', cookie)
      .expect(200);
  });
  it('rechaza cookies ausentes, manipuladas o vencidas y peticiones sin cabecera CSRF', async () => {
    for (const path of ['login', 'refresh', 'logout']) {
      await request(app.getHttpServer())
        .post(`/api/v1/auth/${path}`)
        .send({ email, password: 'Integration123!' })
        .expect(403);
    }
    for (const cookie of ['', 'cmpc_session=bad', `cmpc_session=${'f'.repeat(64)}`]) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('X-Session-Request', '1')
        .set('Cookie', cookie)
        .expect(401);
    }
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Session-Request', '1')
      .send({ email, password: 'Integration123!' })
      .expect(200);
    await db.authSession.updateMany({ where: { userId }, data: { expiresAt: new Date(0) } });
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('X-Session-Request', '1')
      .set('Cookie', login.headers['set-cookie'])
      .expect(401);
  });
  it('reemplaza una sesión anterior al volver a iniciar sesión en el mismo navegador', async () => {
    const login = () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Session-Request', '1')
        .send({ email, password: 'Integration123!' });
    const previous = await login().expect(200);
    const current = await login().set('Cookie', previous.headers['set-cookie']).expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('X-Session-Request', '1')
      .set('Cookie', previous.headers['set-cookie'])
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('X-Session-Request', '1')
      .set('Cookie', current.headers['set-cookie'])
      .expect(200);
  });
  it('rechaza DTO incorrecto y null en PATCH', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/books')
      .auth(token, { type: 'bearer' })
      .send({ ...dto, price: '-1' })
      .expect(400);
  });
  it('crea libro real con auditoría', async () => {
    const r = await request(app.getHttpServer())
      .post('/api/v1/books')
      .auth(token, { type: 'bearer' })
      .send(dto)
      .expect(201);
    id = r.body.data.id;
    expect(r.body.data.price).toBe('12500.5');
    expect(await db.auditLog.count({ where: { entityId: id, action: 'CREATE' } })).toBe(1);
    await request(app.getHttpServer())
      .patch(`/api/v1/books/${id}`)
      .auth(token, { type: 'bearer' })
      .send({ title: null })
      .expect(400);
  });
  it('aplica los cuatro filtros, búsqueda, orden y paginación', async () => {
    const b = await db.book.findUniqueOrThrow({ where: { id } });
    const r = await request(app.getHttpServer())
      .get('/api/v1/books')
      .auth(token, { type: 'bearer' })
      .query({
        search: prefix,
        authorId: b.authorId,
        publisherId: b.publisherId,
        genreId: b.genreId,
        available: 'true',
        pageSize: 1,
        sort: 'author:asc,price:desc',
      })
      .expect(200);
    expect(r.body.data).toHaveLength(1);
    expect(r.body.meta).toEqual({ page: 1, pageSize: 1, total: 1, totalPages: 1 });
    await request(app.getHttpServer())
      .get('/api/v1/books')
      .auth(token, { type: 'bearer' })
      .query({ sort: 'password:asc' })
      .expect(400);
  });
  it('edita atributos, preserva catálogos y registra cambios', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/books/${id}`)
      .auth(token, { type: 'bearer' })
      .send({ price: '20000', isAvailable: false })
      .expect(200);
    const r = await request(app.getHttpServer())
      .get(`/api/v1/books/${id}`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(r.body.data.isAvailable).toBe(false);
    expect(await db.auditLog.count({ where: { entityId: id, action: 'UPDATE' } })).toBe(1);
  });
  it('rechaza imagen falsa y guarda una portada real', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/books/${id}/image`)
      .auth(token, { type: 'bearer' })
      .attach('file', Buffer.from('fake'), { filename: 'fake.png', contentType: 'image/png' })
      .expect(400);
    const image = await sharp({
      create: { width: 10, height: 20, channels: 3, background: '#234' },
    })
      .png()
      .toBuffer();
    const r = await request(app.getHttpServer())
      .post(`/api/v1/books/${id}/image`)
      .auth(token, { type: 'bearer' })
      .attach('file', image, { filename: 'cover.png', contentType: 'image/png' })
      .expect(201);
    expect(r.body.data.imageUrl).toMatch(/\.webp$/);
  });
  it('exporta CSV filtrado sin envelope ni límite de página', async () => {
    const r = await request(app.getHttpServer())
      .get('/api/v1/books/export.csv')
      .auth(token, { type: 'bearer' })
      .query({ search: prefix, page: 99, pageSize: 1 })
      .expect(200);
    expect(r.headers['content-type']).toContain('text/csv');
    expect(r.text).toContain(prefix);
    expect(r.text).toContain('No disponible');
  });
  it('revierte libro y catálogos cuando no puede auditar', async () => {
    const books = app.get(BooksService);
    await expect(
      books.create(
        { ...dto, title: prefix + ' rollback' },
        { actorId: randomUUID(), requestId: 'rollback' },
      ),
    ).rejects.toThrow();
    expect(await db.book.count({ where: { title: prefix + ' rollback' } })).toBe(0);
  });
  it('retira lógicamente, conserva auditoría y excluye detalle, lista y CSV', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/books/${id}`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect((await db.book.findUniqueOrThrow({ where: { id } })).deletedAt).not.toBeNull();
    await request(app.getHttpServer())
      .get(`/api/v1/books/${id}`)
      .auth(token, { type: 'bearer' })
      .expect(404);
    const list = await request(app.getHttpServer())
      .get('/api/v1/books')
      .auth(token, { type: 'bearer' })
      .query({ search: prefix })
      .expect(200);
    expect(list.body.meta.total).toBe(0);
    const csv = await request(app.getHttpServer())
      .get('/api/v1/books/export.csv')
      .auth(token, { type: 'bearer' })
      .query({ search: prefix })
      .expect(200);
    expect(csv.text).not.toContain(prefix);
    expect(await db.auditLog.count({ where: { entityId: id, action: 'DELETE' } })).toBe(1);
  });
});
