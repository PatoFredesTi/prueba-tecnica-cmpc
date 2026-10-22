import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ApiExceptionFilter, ResponseInterceptor, requestId } from './common/http';
import helmet from 'helmet';
import { securityConfig } from './security/config';
import type { Request, Response, NextFunction } from 'express';
export function setup(app: INestApplication) {
  const config = securityConfig();
  app.getHttpAdapter().getInstance().set('trust proxy', config.proxyHops);
  app.use('/api', (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.use(requestId);
  app.enableCors({
    origin: config.origins,
    exposedHeaders: ['X-Request-Id'],
  });
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
}
