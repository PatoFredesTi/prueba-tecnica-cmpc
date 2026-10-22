import { Controller, Get, Header, NotFoundException, Param, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiProduces, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { ImageStoragePort } from './image-storage';
@ApiTags('Portadas')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(
    private prisma: PrismaService,
    private storage: ImageStoragePort,
  ) {}
  @Get(':filename')
  @Header('Cache-Control', 'private, no-store')
  @ApiProduces('image/webp')
  async read(@Param('filename') filename: string) {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.webp$/i.test(filename))
      throw new NotFoundException('Portada no encontrada');
    const book = await this.prisma.book.findFirst({
      where: {
        deletedAt: null,
        imageUrl: { in: [`/uploads/${filename}`, `/api/v1/files/${filename}`] },
      },
      select: { id: true },
    });
    if (!book) throw new NotFoundException('Portada no encontrada');
    return new StreamableFile(await this.storage.read(filename), {
      type: 'image/webp',
      disposition: 'inline',
    });
  }
}
