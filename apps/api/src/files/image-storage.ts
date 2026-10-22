import { Injectable, BadRequestException } from '@nestjs/common';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
export abstract class ImageStoragePort {
  abstract save(file: Express.Multer.File): Promise<string>;
  abstract remove(url: string): Promise<void>;
}
@Injectable()
export class LocalImageStorage extends ImageStoragePort {
  async save(file: Express.Multer.File) {
    if (
      !file ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype) ||
      file.size > 5 * 1024 * 1024
    )
      throw new BadRequestException('Usa una imagen JPEG, PNG o WebP de hasta 5 MB');
    let buffer: Buffer;
    try {
      const input = sharp(file.buffer, { limitInputPixels: 25000000, animated: false });
      const meta = await input.metadata();
      if (!['jpeg', 'png', 'webp'].includes(meta.format || '')) throw new Error();
      buffer = await input
        .rotate()
        .resize({ width: 1200, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      throw new BadRequestException('El archivo no contiene una imagen válida');
    }
    const directory = process.env.UPLOAD_DIR || './uploads';
    await mkdir(directory, { recursive: true });
    const filename = randomUUID() + '.webp';
    await writeFile(join(directory, filename), buffer);
    return '/uploads/' + filename;
  }
  async remove(url: string) {
    try {
      await unlink(join(process.env.UPLOAD_DIR || './uploads', basename(url)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}
