import { randomBytes } from 'node:crypto';
import { securityConfig } from './config';
const local = () => ({ JWT_SECRET: randomBytes(32).toString('hex') });
it('acepta una clave propia y limita por defecto proxy y documentación al entorno local', () => {
  expect(securityConfig(local())).toMatchObject({
    production: false,
    proxyHops: 0,
    swagger: true,
    secureCookie: false,
  });
  expect(securityConfig({ ...local(), SWAGGER_ENABLED: 'false' }).swagger).toBe(false);
});
it.each(['', 'local-demo-change-this-secret-at-least-32-chars', 'a'.repeat(64), 'short'])(
  'rechaza una clave vacía, publicada o débil',
  (JWT_SECRET) => {
    expect(() => securityConfig({ JWT_SECRET })).toThrow('JWT_SECRET');
  },
);
it.each(['*', 'http://localhost:5173/path', 'file:///tmp/a', 'not-a-url'])(
  'rechaza origen inválido',
  (CORS_ORIGIN) => {
    expect(() => securityConfig({ ...local(), CORS_ORIGIN })).toThrow('CORS_ORIGIN');
  },
);
it('requiere HTTPS, cookie Secure y contraseñas propias en producción; deshabilita Swagger', () => {
  const env = {
    ...local(),
    APP_ENV: 'production',
    SESSION_COOKIE_SECURE: 'true',
    CORS_ORIGIN: 'https://books.example.com',
    POSTGRES_PASSWORD: randomBytes(24).toString('hex'),
    SEED_ADMIN_PASSWORD: randomBytes(24).toString('hex'),
    SWAGGER_ENABLED: 'true',
  };
  expect(securityConfig(env)).toMatchObject({
    production: true,
    swagger: false,
    secureCookie: true,
  });
  for (const patch of [
    { SESSION_COOKIE_SECURE: 'false' },
    { CORS_ORIGIN: 'http://books.example.com' },
  ])
    expect(() => securityConfig({ ...env, ...patch })).toThrow('HTTPS');
  for (const value of ['', 'DemoCMPC2026!', 'replace-this-production-password'])
    expect(() => securityConfig({ ...env, SEED_ADMIN_PASSWORD: value })).toThrow('contraseñas');
});
it('rechaza entornos y confianza en proxy ambiguos', () => {
  expect(() => securityConfig({ ...local(), APP_ENV: 'prod' })).toThrow('APP_ENV');
  expect(() => securityConfig({ ...local(), TRUST_PROXY_HOPS: 'true' })).toThrow(
    'TRUST_PROXY_HOPS',
  );
  expect(securityConfig({ ...local(), TRUST_PROXY_HOPS: '1' }).proxyHops).toBe(1);
});
