import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Readable } from 'node:stream';
import { AuthRequest, context } from '../common/http';
import { BooksService } from './books.service';
import { BookQueryDto, CreateBookDto, UpdateBookDto } from './books.dto';
@ApiTags('Libros')
@ApiBearerAuth()
@Controller('books')
export class BooksController {
  constructor(private books: BooksService) {}
  @Get() list(@Query() query: BookQueryDto) {
    return this.books.list(query);
  }
  @Get('export.csv')
  @ApiProduces('text/csv')
  export(@Query() query: BookQueryDto) {
    return new StreamableFile(Readable.from(this.books.exportCsv(query)), {
      type: 'text/csv; charset=utf-8',
      disposition: 'attachment; filename="cmpc-libros.csv"',
    });
  }
  @Get(':id') find(@Param('id', ParseUUIDPipe) id: string) {
    return this.books.find(id);
  }
  @Post() create(@Body() dto: CreateBookDto, @Req() req: AuthRequest) {
    return this.books.create(dto, context(req));
  }
  @Patch(':id') update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBookDto,
    @Req() req: AuthRequest,
  ) {
    return this.books.update(id, dto, context(req));
  }
  @Delete(':id') remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthRequest) {
    return this.books.remove(id, context(req));
  }
  @Post(':id/image')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  upload(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthRequest,
  ) {
    return this.books.upload(id, file, context(req));
  }
}
