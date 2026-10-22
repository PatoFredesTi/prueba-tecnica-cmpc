import {
  ArgumentsHost,
  CallHandler,
  Catch,
  ExceptionFilter,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
  ExecutionContext,
  StreamableFile,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { map, finalize } from 'rxjs/operators';
export interface RequestContext {
  actorId: string;
  requestId: string;
}
export interface AuthRequest extends Request {
  user: { sub: string; email: string };
  requestId: string;
}
export function context(req: AuthRequest): RequestContext {
  return { actorId: req.user.sub, requestId: req.requestId };
}
export function requestId(req: Request, res: Response, next: () => void) {
  (req as AuthRequest).requestId = randomUUID();
  res.setHeader('X-Request-Id', (req as AuthRequest).requestId);
  next();
}
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private logger = new Logger('HTTP');
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<AuthRequest>();
    let status = 500,
      code = 'INTERNAL_ERROR',
      message = 'No fue posible completar la operación',
      details: unknown = undefined;
    if (error instanceof HttpException) {
      status = error.getStatus();
      const body = error.getResponse();
      const value =
        typeof body === 'string' ? body : (body as { message?: string | string[] }).message;
      message = Array.isArray(value) ? 'Los datos ingresados no son válidos' : value || message;
      details = Array.isArray(value) ? value.map((message) => ({ message })) : undefined;
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        status = 409;
        message = 'El registro ya existe';
      }
      if (error.code === 'P2025') {
        status = 404;
        message = 'Libro no encontrado';
      }
      if (error.code === 'P2003') {
        status = 400;
        message = 'La referencia no es válida';
      }
    }
    code =
      (
        {
          400: 'VALIDATION_ERROR',
          401: 'UNAUTHORIZED',
          403: 'FORBIDDEN',
          404: 'NOT_FOUND',
          409: 'CONFLICT',
          413: 'FILE_TOO_LARGE',
          429: 'TOO_MANY_REQUESTS',
        } as Record<number, string>
      )[status] || code;
    this.logger[status >= 500 ? 'error' : 'warn'](
      JSON.stringify({ requestId: request.requestId, statusCode: status, code }),
    );
    if (!response.headersSent)
      response.status(status).json({
        statusCode: status,
        code,
        message,
        ...(details ? { details } : {}),
        requestId: request.requestId,
      });
    else response.end();
  }
}
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  private logger = new Logger('HTTP');
  intercept(ctx: ExecutionContext, next: CallHandler) {
    const start = Date.now(),
      req = ctx.switchToHttp().getRequest<AuthRequest>();
    return next.handle().pipe(
      map((value) => {
        if (value instanceof StreamableFile) return value;
        if (value && Object.hasOwn(value, 'data') && Object.hasOwn(value, 'meta')) return value;
        return { data: value, meta: { requestId: req.requestId } };
      }),
      finalize(() =>
        this.logger.log(
          JSON.stringify({
            requestId: req.requestId,
            method: req.method,
            path: req.path,
            durationMs: Date.now() - start,
          }),
        ),
      ),
    );
  }
}
