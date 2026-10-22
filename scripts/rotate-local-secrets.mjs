import { randomBytes } from 'node:crypto';
import { readFile, writeFile, rename, chmod } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
const original = await readFile('.env', 'utf8');
const current = parseEnv(original);
const url = new URL(current.DATABASE_URL);
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || current.APP_ENV === 'production')
  throw new Error('Este comando es exclusivamente para una base local de desarrollo.');
const role = decodeURIComponent(url.username);
if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(role))
  throw new Error('Nombre de rol PostgreSQL no permitido');
const secret = () => randomBytes(32).toString('hex');
const databasePassword = secret(),
  adminPassword = secret();
url.password = databasePassword;
const values = {
  POSTGRES_PASSWORD: databasePassword,
  DATABASE_URL: url.toString(),
  JWT_SECRET: secret(),
  SEED_ADMIN_PASSWORD: adminPassword,
};
let next = original;
for (const [key, value] of Object.entries(values))
  next = next.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${value}`);
// Preserve the new credentials privately before changing the database. Never log them.
await writeFile('.env.rotation-pending', next, { flag: 'wx', mode: 0o600 });
const prisma = new PrismaClient({ datasources: { db: { url: current.DATABASE_URL } } });
try {
  const passwordHash = await hash(adminPassword, 12);
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { email: current.SEED_ADMIN_EMAIL.toLowerCase() },
      data: { passwordHash },
    });
    await tx.authSession.deleteMany({});
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: 'CREDENTIAL_ROTATION',
        entityType: 'User',
        entityId: user.id,
      },
    });
    // Role identifier validated above; password is generated hexadecimal, never user input.
    await tx.$executeRawUnsafe(`ALTER ROLE "${role}" WITH PASSWORD '${databasePassword}'`);
  });
  await rename('.env.rotation-pending', '.env');
  await chmod('.env', 0o600);
  console.log(
    'Claves JWT, PostgreSQL y administrador rotadas. Sesiones revocadas. Credenciales guardadas solo en .env. Recrea los contenedores para cargar la configuración.',
  );
} catch {
  console.error(
    'La rotación no se completó. Conserva .env y .env.rotation-pending para revisar el estado; no vuelvas a ejecutar a ciegas. No se imprimieron secretos.',
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
