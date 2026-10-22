import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const destination = resolve('.env');
const secret = () => randomBytes(32).toString('hex');
let template = await readFile('.env.example', 'utf8');
const databasePassword = secret();
const values = {
  JWT_SECRET: secret(),
  POSTGRES_PASSWORD: databasePassword,
  SEED_ADMIN_PASSWORD: secret(),
  DATABASE_URL: `postgresql://cmpc:${databasePassword}@localhost:55439/cmpc_libros?schema=public`,
};
for (const [key, value] of Object.entries(values))
  template = template.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${value}`);
try {
  await writeFile(destination, template, { flag: 'wx', mode: 0o600 });
  console.log(
    'Configuración local creada en .env con claves aleatorias. Consulta allí SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD.',
  );
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log(
    '.env ya existe; se conserva. Para rotar una instalación existente usa npm run security:rotate-local.',
  );
}
