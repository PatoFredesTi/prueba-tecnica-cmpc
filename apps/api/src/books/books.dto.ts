import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsBooleanString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
export const cleanName = (value: unknown) =>
  typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/g, ' ') : value;
export class CreateBookDto {
  @ApiProperty()
  @Transform(({ value }) => cleanName(value))
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;
  @ApiProperty()
  @Transform(({ value }) => cleanName(value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  author!: string;
  @ApiProperty()
  @Transform(({ value }) => cleanName(value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  publisher!: string;
  @ApiProperty()
  @Transform(({ value }) => cleanName(value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  genre!: string;
  @ApiProperty({
    example: '12990.00',
    description: 'Decimal no negativo como string; máximo 10 enteros y 2 decimales',
  })
  @IsString()
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message: 'price debe ser un monto no negativo con hasta dos decimales',
  })
  price!: string;
  @ApiProperty() @IsBoolean() isAvailable!: boolean;
}
export class UpdateBookDto extends PartialType(CreateBookDto, { skipNullProperties: false }) {}
export class BookQueryDto {
  @ApiPropertyOptional({ default: 1 }) @Type(() => Number) @IsInt() @Min(1) @Max(1000000) page = 1;
  @ApiPropertyOptional({ default: 10, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 10;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) search?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() authorId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() publisherId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() genreId?: string;
  @ApiPropertyOptional({ enum: ['true', 'false'] })
  @IsOptional()
  @IsBooleanString()
  available?: string;
  @ApiPropertyOptional({ example: 'title:asc,price:desc' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Matches(
    /^(title|price|createdAt|author|publisher):(asc|desc)(,(title|price|createdAt|author|publisher):(asc|desc)){0,4}$/,
    { message: 'sort contiene un campo o dirección no permitido' },
  )
  sort = 'title:asc';
}
