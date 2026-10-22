import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { setup } from './setup';
config({ path: resolve(process.cwd(), '../../.env') });
config();
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new ConsoleLogger({ json: true, colors: false }),
  });
  setup(app);
  app.enableShutdownHooks();
  app.useStaticAssets(resolve(process.env.UPLOAD_DIR || './uploads'), {
    prefix: '/uploads/',
    index: false,
    dotfiles: 'deny',
  });
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
  await app.listen(Number(process.env.PORT) || 3000, '0.0.0.0');
}
void bootstrap();
