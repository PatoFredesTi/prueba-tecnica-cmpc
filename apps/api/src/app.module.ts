import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { BooksModule } from './books/books.module';
import { CatalogsModule } from './catalogs/catalogs.module';
import { HealthModule } from './health/health.module';
@Module({ imports: [PrismaModule, AuthModule, BooksModule, CatalogsModule, HealthModule] })
export class AppModule {}
