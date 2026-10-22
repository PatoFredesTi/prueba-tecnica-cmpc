export function securityConfig(env: NodeJS.ProcessEnv = process.env) {
  const environment = env.APP_ENV || 'local';
  if (!['local', 'production'].includes(environment))
    throw new Error('APP_ENV debe ser local o production');
  const production = environment === 'production';
  const secret = env.JWT_SECRET || '';
  if (!/^[a-f0-9]{64,128}$/i.test(secret) || new Set(secret).size < 12)
    throw new Error(
      'JWT_SECRET debe ser una clave aleatoria hexadecimal de al menos 32 bytes. Ejecuta npm run setup:env.',
    );
  const secureCookie = env.SESSION_COOKIE_SECURE === 'true';
  const origins = (env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:8080')
    .split(',')
    .map((s) => s.trim());
  if (
    origins.some((origin) => {
      try {
        const url = new URL(origin);
        return !['http:', 'https:'].includes(url.protocol) || url.origin !== origin;
      } catch {
        return true;
      }
    })
  )
    throw new Error(
      'CORS_ORIGIN debe contener orígenes HTTP(S) explícitos, sin rutas ni comodines',
    );
  if (production && (!secureCookie || origins.some((origin) => !origin.startsWith('https://'))))
    throw new Error('Producción requiere SESSION_COOKIE_SECURE=true y orígenes HTTPS');
  if (
    production &&
    [env.POSTGRES_PASSWORD, env.SEED_ADMIN_PASSWORD].some(
      (value) => !value || value.length < 20 || /demo|change|replace|cmpc_local/i.test(value),
    )
  )
    throw new Error('Producción requiere contraseñas propias de al menos 20 caracteres');
  const proxyHops = Number(env.TRUST_PROXY_HOPS || '0');
  if (![0, 1].includes(proxyHops)) throw new Error('TRUST_PROXY_HOPS debe ser 0 o 1');
  return {
    secret,
    secureCookie,
    production,
    origins,
    proxyHops,
    swagger: !production && env.SWAGGER_ENABLED !== 'false',
  };
}
