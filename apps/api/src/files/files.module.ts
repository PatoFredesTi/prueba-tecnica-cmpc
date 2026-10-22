import { Module } from '@nestjs/common';
import { ImageStoragePort, LocalImageStorage } from './image-storage';
@Module({
  providers: [{ provide: ImageStoragePort, useClass: LocalImageStorage }],
  exports: [ImageStoragePort],
})
export class FilesModule {}
