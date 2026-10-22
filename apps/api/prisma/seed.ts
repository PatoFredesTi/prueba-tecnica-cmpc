import { config } from 'dotenv';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
config({ path: resolve(process.cwd(), '../../.env') });
config();
const prisma = new PrismaClient();
const books = [
  ['La casa de los espíritus', 'Isabel Allende', 'Plaza & Janés', 'Novela', '18990', true],
  ['Cien años de soledad', 'Gabriel García Márquez', 'Sudamericana', 'Novela', '16990', true],
  [
    'Veinte poemas de amor y una canción desesperada',
    'Pablo Neruda',
    'Seix Barral',
    'Poesía',
    '10990',
    true,
  ],
  ['El principito', 'Antoine de Saint-Exupéry', 'Salamandra', 'Literatura infantil', '9990', true],
  ['Historia de Chile', 'Sergio Villalobos', 'Editorial Universitaria', 'Historia', '24990', false],
  ['Ficciones', 'Jorge Luis Borges', 'Debolsillo', 'Cuento', '13990', true],
  ['Desolación', 'Gabriela Mistral', 'Editorial Universitaria', 'Poesía', '11990', true],
  ['Rayuela', 'Julio Cortázar', 'Alfaguara', 'Novela', '19990', false],
  ['Sub terra', 'Baldomero Lillo', 'Zig-Zag', 'Cuento', '8990', true],
  ['Los detectives salvajes', 'Roberto Bolaño', 'Anagrama', 'Novela', '22990', true],
  ['Papelucho', 'Marcela Paz', 'SM', 'Literatura infantil', '7990', true],
  ['El túnel', 'Ernesto Sabato', 'Seix Barral', 'Novela', '12990', false],
  ['La tregua', 'Mario Benedetti', 'Alfaguara', 'Novela', '14990', true],
  ['Antología poética', 'Nicanor Parra', 'Debolsillo', 'Poesía', '15990', true],
  ['El viejo y el mar', 'Ernest Hemingway', 'Debolsillo', 'Novela', '10990', true],
  ['El bosque chileno', 'Adriana Hoffmann', 'Fundación Claudio Gay', 'Naturaleza', '29990', true],
  ['Mujeres del alma mía', 'Isabel Allende', 'Plaza & Janés', 'Ensayo', '17990', false],
  [
    'Crónica de una muerte anunciada',
    'Gabriel García Márquez',
    'Sudamericana',
    'Novela',
    '12990',
    true,
  ],
  ['Mala onda', 'Alberto Fuguet', 'Alfaguara', 'Novela', '15990', true],
  ['De amor y de sombra', 'Isabel Allende', 'Plaza & Janés', 'Novela', '14990', true],
  ['El infinito en un junco', 'Irene Vallejo', 'Siruela', 'Ensayo', '25990', true],
  ['La amortajada', 'María Luisa Bombal', 'Zig-Zag', 'Novela', '11990', true],
  ['Altazor', 'Vicente Huidobro', 'Editorial Universitaria', 'Poesía', '13990', false],
  ['El lugar sin límites', 'José Donoso', 'Alfaguara', 'Novela', '12990', true],
] as const;
async function seed() {
  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase(),
    password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password || password.length < 12)
    throw new Error('Configura SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD (mínimo 12 caracteres)');
  // No sobrescribe contraseñas existentes ni vuelve a crear libros retirados.
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash: await hash(password, 12) },
  });
  for (const [index, [title, author, publisher, genre, price, isAvailable]] of books.entries()) {
    const catalog = (name: string) => ({
      where: { normalizedName: name.normalize('NFKC').toLocaleLowerCase('es') },
      update: {},
      create: { name, normalizedName: name.normalize('NFKC').toLocaleLowerCase('es') },
    });
    const id = `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
    await prisma.$transaction(async (tx) => {
      if (await tx.book.findUnique({ where: { id } })) return;
      const a = await tx.author.upsert(catalog(author)),
        p = await tx.publisher.upsert(catalog(publisher)),
        g = await tx.genre.upsert(catalog(genre));
      await tx.book.create({
        data: { id, title, authorId: a.id, publisherId: p.id, genreId: g.id, price, isAvailable },
      });
    });
  }
  console.log('Seed completado: usuario configurado y 24 libros de demostración.');
}
seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
