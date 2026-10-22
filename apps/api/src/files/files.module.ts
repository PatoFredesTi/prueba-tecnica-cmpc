import { FilesController } from './files.controller';
import { Module } from '@nestjs/common';
import { ImageStoragePort, LocalImageStorage } from './image-storage';
@Module({
  controllers: [FilesController],
  providers: [{ provide: ImageStoragePort, useClass: LocalImageStorage }],
  exports: [ImageStoragePort],
})
export class FilesModule {}
