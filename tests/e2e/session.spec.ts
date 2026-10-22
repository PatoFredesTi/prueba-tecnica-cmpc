import { test, expect } from '@playwright/test';

test('F5 conserva sesión, ruta y filtros; logout impide recuperarla', async ({ page, context }) => {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Configura las credenciales de prueba');
  await page.goto('/books');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: /Catálogo de libros/ })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
  await page.getByLabel('Buscar libros').fill('casa');
  await page.getByLabel('Disponibilidad', { exact: true }).selectOption('true');
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(2);
  const originalUrl = page.url();
  const cookie = (await context.cookies()).find((item) => item.name === 'cmpc_session');
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/api/v1/auth' });
  await page.reload();
  await expect(page.getByRole('heading', { name: /Catálogo de libros/ })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
  expect(page.url()).toBe(originalUrl);
  await expect(page.getByLabel('Buscar libros')).toHaveValue('casa');
  await expect(page.getByLabel('Disponibilidad', { exact: true })).toHaveValue('true');
  expect(
    await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })),
  ).toEqual({ local: 0, session: 0 });
  // Another tab and a second reload must not invalidate the original session.
  const tab = await context.newPage();
  await tab.goto(originalUrl);
  await expect(tab.getByRole('heading', { name: /Catálogo de libros/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: /Catálogo de libros/ })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Qué bueno verte.' })).toBeVisible();
  expect((await context.cookies()).find((item) => item.name === 'cmpc_session')).toBeUndefined();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Qué bueno verte.' })).toBeVisible();
  await tab.reload();
  await expect(tab.getByRole('heading', { name: 'Qué bueno verte.' })).toBeVisible();
});
