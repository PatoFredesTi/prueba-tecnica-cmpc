import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { setup } from './setup';
import { securityConfig } from './security/config';
config({ path: resolve(process.cwd(), '../../.env') });
config();
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new ConsoleLogger({ json: true, colors: false }),
  });
  setup(app);
  app.enableShutdownHooks();
  const security = securityConfig();
  if (security.swagger) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('CMPC Libros API')
        .setDescription('Inventario y catálogo interno de libros')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }
  await app.listen(Number(process.env.PORT) || 3000, process.env.HOST || '127.0.0.1');
}
void bootstrap();
