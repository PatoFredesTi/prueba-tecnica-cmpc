import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/auth';
import { PrismaService } from '../prisma/prisma.service';
@ApiTags('Salud')
@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}
  @Public() @Get() async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'connected' };
    } catch {
      throw new ServiceUnavailableException('Base de datos no disponible');
    }
  }
}
