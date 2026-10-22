import { LocalImageStorage } from './image-storage';
import sharp from 'sharp';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
describe('LocalImageStorage', () => {
  let directory: string, old: string | undefined;
  const storage = new LocalImageStorage();
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'cmpc-images-'));
    old = process.env.UPLOAD_DIR;
    process.env.UPLOAD_DIR = directory;
  });
  afterAll(async () => {
    if (old) process.env.UPLOAD_DIR = old;
    else delete process.env.UPLOAD_DIR;
    await rm(directory, { recursive: true, force: true });
  });
  it('valida contenido real, convierte a WebP y persiste', async () => {
    const buffer = await sharp({
      create: { width: 30, height: 40, channels: 3, background: '#ff0000' },
    })
      .png()
      .toBuffer();
    const url = await storage.save({ buffer, size: buffer.length, mimetype: 'image/png' } as any);
    expect(url).toMatch(/^\/uploads\/[\w-]+\.webp$/);
    expect(await readdir(directory)).toHaveLength(1);
    await storage.remove(url);
    await storage.remove(url);
    expect(await readdir(directory)).toHaveLength(0);
  });
  it.each([
    undefined,
    { mimetype: 'text/plain', size: 10 },
    { mimetype: 'image/png', size: 6 * 1024 * 1024 },
  ])('rechaza archivo ausente, tipo o tamaño inválido', async (file) => {
    await expect(storage.save(file as any)).rejects.toThrow('hasta 5 MB');
  });
  it('rechaza contenido falso y formatos no permitidos', async () => {
    await expect(
      storage.save({ buffer: Buffer.from('fake'), size: 4, mimetype: 'image/png' } as any),
    ).rejects.toThrow('imagen válida');
    const gif = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#fff' } })
      .gif()
      .toBuffer();
    await expect(
      storage.save({ buffer: gif, size: gif.length, mimetype: 'image/png' } as any),
    ).rejects.toThrow('imagen válida');
  });
});
