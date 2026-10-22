import { FilesController } from './files.controller';
import { LocalImageStorage } from './image-storage';
import { StreamableFile } from '@nestjs/common';
const filename = '00000000-0000-4000-8000-000000000001.webp';
it('sirve solo portadas de libros activos y admite referencias antiguas', async () => {
  const db = { book: { findFirst: jest.fn().mockResolvedValue({ id: 'book' }) } };
  const storage = { read: jest.fn().mockResolvedValue(Buffer.from('image')) };
  const c = new FilesController(db as any, storage as any);
  expect(await c.read(filename)).toBeInstanceOf(StreamableFile);
  expect(db.book.findFirst).toHaveBeenCalledWith({
    where: {
      deletedAt: null,
      imageUrl: { in: [`/uploads/${filename}`, `/api/v1/files/${filename}`] },
    },
    select: { id: true },
  });
  db.book.findFirst.mockResolvedValue(null);
  await expect(c.read(filename)).rejects.toThrow('Portada no encontrada');
  expect(storage.read).toHaveBeenCalledTimes(1);
});
it.each(['../.env', 'x.svg', '%2e%2e%2f.env', 'file.webp'])(
  'rechaza rutas fuera del formato de portada',
  async (name) => {
    await expect(new FilesController({} as any, {} as any).read(name)).rejects.toThrow(
      'Portada no encontrada',
    );
    await expect(new LocalImageStorage().read(name)).rejects.toThrow('Portada no encontrada');
  },
);
it('devuelve 404 si el archivo físico no existe', async () => {
  await expect(new LocalImageStorage().read(filename)).rejects.toThrow('Portada no encontrada');
});
