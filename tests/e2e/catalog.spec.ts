import { test, expect } from '@playwright/test';
import sharp from 'sharp';

test('flujo completo: login, búsqueda, filtros, CRUD, portada, CSV y logout', async ({ page }) => {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password)
    throw new Error('Configura SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD para E2E');
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Qué bueno verte.' })).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/login.png', fullPage: true });
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: /Catálogo de libros/ })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/catalogo.png', fullPage: true });
  await page.getByLabel('Todos los géneros').selectOption({ label: 'Novela' });
  await page.getByLabel('Disponibilidad', { exact: true }).selectOption('true');
  await page.getByLabel('Buscar libros').fill('casa');
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(2);
  await expect(
    page.getByRole('cell', { name: /^Sin portada: La casa de los espíritus/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Ordenar/ }).click();
  await page.getByRole('button', { name: 'Agregar criterio' }).click();
  await page.getByLabel('Dirección de orden 2').selectOption('desc');
  await expect(page).toHaveURL(/sort=/);
  await page.getByRole('button', { name: /Ordenar/ }).click();
  await page.getByRole('button', { name: 'Vista de cuadrícula' }).click();
  await expect(page.getByRole('heading', { name: 'La casa de los espíritus' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'docs/screenshots/catalogo-movil.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('link', { name: 'Nuevo libro', exact: true }).click();
  const title = `Prueba E2E ${Date.now()}`;
  await page.getByLabel('Título *', { exact: true }).fill(title);
  await page.getByLabel('Autor principal *').fill('Autor de prueba');
  await page.getByLabel('Editorial *', { exact: true }).fill('Editorial de prueba');
  await page.getByLabel('Género *', { exact: true }).fill('Ensayo');
  await page.getByLabel('Precio (CLP) *').fill('12000.50');
  const cover = await sharp({
    create: { width: 160, height: 220, channels: 3, background: '#205c44' },
  })
    .png()
    .toBuffer();
  await page
    .locator('#image')
    .setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: cover });
  await page.getByRole('button', { name: 'Crear libro', exact: true }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  const detailUrl = page.url();
  await expect(page.getByRole('img', { name: `Portada de ${title}` })).toBeVisible();
  await page.getByRole('link', { name: 'Editar libro', exact: true }).click();
  await page.getByLabel('Precio (CLP) *').fill('15000');
  await page.getByLabel('Disponible en catálogo').uncheck();
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Libro actualizado correctamente.')).toBeVisible();
  await expect(page.getByText('No disponible', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Volver al catálogo' }).click();
  await page.getByLabel('Buscar libros').fill(title);
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(2);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('cmpc-libros.csv');
  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString('utf8')).toContain(title);
  await page.getByRole('link', { name: `Ver ${title}`, exact: true }).click();
  expect(page.url()).toBe(detailUrl);
  await page.getByRole('button', { name: 'Eliminar libro', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Eliminar libro', exact: true }).click();
  await page.getByRole('button', { name: 'Sí, eliminar libro' }).click();
  await expect(page.getByRole('heading', { name: /Catálogo de libros/ })).toBeVisible();
  await page.getByLabel('Buscar libros').fill(title);
  await expect(page.getByText('No encontramos libros')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Qué bueno verte.' })).toBeVisible();
  expect(browserErrors).toEqual([]);
});
