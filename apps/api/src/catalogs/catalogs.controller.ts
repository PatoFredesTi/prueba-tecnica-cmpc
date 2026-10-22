import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
@ApiTags('Catálogos')
@ApiBearerAuth()
@Controller('catalogs')
export class CatalogsController {
  constructor(private prisma: PrismaService) {}
  @Get('authors') authors() {
    return this.prisma.author.findMany({ orderBy: { name: 'asc' } });
  }
  @Get('publishers') publishers() {
    return this.prisma.publisher.findMany({ orderBy: { name: 'asc' } });
  }
  @Get('genres') genres() {
    return this.prisma.genre.findMany({ orderBy: { name: 'asc' } });
  }
}
