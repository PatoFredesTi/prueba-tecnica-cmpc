import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BookQueryDto, CreateBookDto, UpdateBookDto } from './books.dto';
import { bookWhere, bookOrder, csvCell } from './query';
describe('Consultas y validación', () => {
  it('combina los cuatro filtros con búsqueda sin incluir eliminados', () => {
    const q = Object.assign(new BookQueryDto(), {
      authorId: 'a',
      publisherId: 'p',
      genreId: 'g',
      available: 'false',
      search: '  chile  ',
      sort: 'author:asc,price:desc',
    });
    expect(bookWhere(q)).toMatchObject({
      deletedAt: null,
      authorId: 'a',
      publisherId: 'p',
      genreId: 'g',
      isAvailable: false,
      OR: [
        { title: { contains: 'chile', mode: 'insensitive' } },
        { author: { name: { contains: 'chile', mode: 'insensitive' } } },
        { publisher: { name: { contains: 'chile', mode: 'insensitive' } } },
      ],
    });
    expect(bookOrder(q)).toEqual([{ author: { name: 'asc' } }, { price: 'desc' }, { id: 'asc' }]);
  });
  it('usa orden estable y no inventa filtros por defecto', () => {
    expect(bookWhere(new BookQueryDto())).toEqual({ deletedAt: null });
    expect(bookOrder(new BookQueryDto())).toEqual([{ title: 'asc' }, { id: 'asc' }]);
    expect(bookOrder(Object.assign(new BookQueryDto(), { sort: 'publisher:desc' }))[0]).toEqual({
      publisher: { name: 'desc' },
    });
  });
  it.each([
    { page: 0 },
    { pageSize: 101 },
    { sort: 'password:asc' },
    { sort: 'title:drop' },
    { available: 'yes' },
    { genreId: 'not-a-uuid' },
    { search: 'x'.repeat(201) },
  ])('rechaza parámetros inválidos %j', async (value) => {
    expect((await validate(plainToInstance(BookQueryDto, value))).length).toBeGreaterThan(0);
  });
  it('transforma paginación y valida nombres/decimales', async () => {
    const query = plainToInstance(BookQueryDto, { page: '2', pageSize: '20' });
    expect(query.page).toBe(2);
    expect(await validate(query)).toHaveLength(0);
    const dto = plainToInstance(CreateBookDto, {
      title: '  Libro   nuevo  ',
      author: 'Autor',
      publisher: 'Editorial',
      genre: 'Novela',
      price: '1.20',
      isAvailable: false,
    });
    expect(dto.title).toBe('Libro nuevo');
    expect(await validate(dto)).toHaveLength(0);
  });
  it.each(['-1', '1.234', '1e3', '10000000000', 'NaN'])('rechaza precio %s', async (price) => {
    expect((await validate(plainToInstance(UpdateBookDto, { price }))).length).toBeGreaterThan(0);
  });
  it('rechaza null y campos vacíos en una actualización', async () => {
    expect(
      (await validate(plainToInstance(UpdateBookDto, { title: null }))).length,
    ).toBeGreaterThan(0);
    expect(
      (await validate(plainToInstance(UpdateBookDto, { author: '   ' }))).length,
    ).toBeGreaterThan(0);
  });
});
describe('CSV', () => {
  it.each([
    ['normal', '"normal"'],
    ['a,"b"\nc', '"a,""b""\nc"'],
    ['=SUM(A1)', '"\'=SUM(A1)"'],
    ['  +1', '"\'  +1"'],
    ['@test', '"\'@test"'],
    ['-1', '"\'-1"'],
    ['\ttexto', '"\'\ttexto"'],
    [null, '""'],
  ])('escapa %j', (input, result) => expect(csvCell(input)).toBe(result));
});
