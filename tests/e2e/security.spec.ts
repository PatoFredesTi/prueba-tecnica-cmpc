import { test, expect } from '@playwright/test';
import { createHmac } from 'node:crypto';

test('Nginx protege documentos sensibles y HTML; la clave publicada ya no permite acceso', async ({
  request,
  page,
}) => {
  const root = await request.get('/');
  expect(root.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(root.headers()['content-security-policy']).toContain("script-src 'self'");
  expect(root.headers()['x-frame-options']).toBe('DENY');
  expect(root.headers()['server']).toBe('nginx');
  for (const url of ['/.env', '/.git/config', '/uploads/00000000-0000-4000-8000-000000000001.webp'])
    expect((await request.get(url)).status()).toBe(404);
  for (const url of [
    '/api/v1/books',
    '/api/v1/books/export.csv',
    '/api/v1/catalogs/authors',
    '/api/v1/files/00000000-0000-4000-8000-000000000001.webp',
  ])
    expect((await request.get(url)).status()).toBe(401);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: '00000000-0000-4000-8000-000000000001', sid: '00000000-0000-4000-8000-000000000002', iss: 'cmpc-libros', aud: 'cmpc-web', exp: Math.floor(Date.now() / 1000) + 60 })}`;
  const signature = createHmac('sha256', 'local-demo-change-this-secret-at-least-32-chars')
    .update(unsigned)
    .digest('base64url');
  expect(
    (
      await request.get('/api/v1/books', {
        headers: { Authorization: `Bearer ${unsigned}.${signature}` },
      })
    ).status(),
  ).toBe(401);
  // Documentation remains usable locally, while production configuration disables it.
  await page.goto('/api/docs');
  await expect(page.getByRole('heading', { name: /CMPC Libros API/ })).toBeVisible();
});
