import {
  Body,
  Controller,
  Injectable,
  Post,
  UnauthorizedException,
  SetMetadata,
  CanActivate,
  ExecutionContext,
  Req,
  HttpCode,
  Res,
  Header,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ApiHeader, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength, isUUID } from 'class-validator';
import { compare, hashSync } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthRequest } from '../common/http';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { CookieOptions, Response } from 'express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
const SESSION_COOKIE = 'cmpc_session';
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.SESSION_COOKIE_SECURE === 'true',
  path: '/api/v1/auth',
});
function sessionCookie(req: AuthRequest) {
  return /(?:^|;\s*)cmpc_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
}
function requireSessionHeader(req: AuthRequest) {
  if (req.headers['x-session-request'] !== '1')
    throw new ForbiddenException('Falta la cabecera X-Session-Request');
}
export const Public = () => SetMetadata('public', true);
export class LoginDto {
  @ApiProperty({ example: 'admin@cmpc.local' }) @IsEmail() @MaxLength(254) email!: string;
  @ApiProperty({ format: 'password' }) @IsString() @MinLength(1) @MaxLength(128) password!: string;
}
@Injectable()
export class AuthService {
  private readonly dummyHash = hashSync('constant-time-missing-user', 12);
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}
  async login(dto: LoginDto, requestId: string, previousToken?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    const valid = await compare(dto.password, user?.passwordHash || this.dummyHash);
    if (!user || !valid) {
      await this.prisma.auditLog.create({
        data: { action: 'LOGIN_FAILED', entityType: 'User', requestId },
      });
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }
    const sessionId = randomUUID();
    const result = await this.issueAccess(user, sessionId);
    const refreshToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_DURATION);
    await this.prisma.$transaction(async (tx) => {
      if (previousToken)
        await tx.authSession.deleteMany({ where: { tokenHash: digest(previousToken) } });
      await tx.authSession.deleteMany({
        where: { userId: user.id, expiresAt: { lte: new Date() } },
      });
      await tx.authSession.create({
        data: { id: sessionId, tokenHash: digest(refreshToken), userId: user.id, expiresAt },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'LOGIN',
          entityType: 'User',
          entityId: user.id,
          requestId,
        },
      });
    });
    return { ...result, refreshToken, expiresAt };
  }
  private async issueAccess(user: { id: string; email: string; role: string }, sessionId: string) {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      sid: sessionId,
      email: user.email,
      role: user.role,
    });
    return { accessToken, user: { id: user.id, email: user.email, role: user.role } };
  }
  async refresh(refreshToken?: string) {
    if (!refreshToken) throw new UnauthorizedException('Inicia sesión para continuar');
    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash: digest(refreshToken) },
      include: { user: true },
    });
    if (!session || session.expiresAt <= new Date())
      throw new UnauthorizedException('Tu sesión expiró. Inicia sesión nuevamente');
    return this.issueAccess(session.user, session.id);
  }
  async logout(refreshToken?: string) {
    if (refreshToken)
      await this.prisma.authSession.deleteMany({ where: { tokenHash: digest(refreshToken) } });
    return { loggedOut: true };
  }
}
@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwt: JwtService,
    private prisma: PrismaService,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride('public', [context.getHandler(), context.getClass()]))
      return true;
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const match = /^Bearer (\S+)$/.exec(req.headers.authorization || '');
    if (!match) throw new UnauthorizedException('Inicia sesión para continuar');
    let claims: { sub?: string; sid?: string };
    try {
      claims = await this.jwt.verifyAsync(match[1], { algorithms: ['HS256'] });
      if (
        typeof claims.sub !== 'string' ||
        typeof claims.sid !== 'string' ||
        !isUUID(claims.sub) ||
        !isUUID(claims.sid)
      )
        throw new Error();
    } catch {
      throw new UnauthorizedException('Tu sesión expiró. Inicia sesión nuevamente');
    }
    // Database failures propagate as server errors; they never grant access.
    const session = await this.prisma.authSession.findUnique({
      where: { id: claims.sid },
      include: { user: true },
    });
    if (!session || session.userId !== claims.sub || session.expiresAt <= new Date())
      throw new UnauthorizedException('Tu sesión expiró. Inicia sesión nuevamente');
    req.user = { sub: session.user.id, email: session.user.email };
    return true;
  }
}
@ApiTags('Autenticación')
@ApiHeader({ name: 'X-Session-Request', required: true, schema: { type: 'string', enum: ['1'] } })
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}
  @Public()
  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async login(
    @Body() dto: LoginDto,
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    requireSessionHeader(req);
    const { refreshToken, expiresAt, ...result } = await this.auth.login(
      dto,
      req.requestId,
      sessionCookie(req),
    );
    res.cookie(SESSION_COOKIE, refreshToken, { ...cookieOptions(), expires: expiresAt });
    return result;
  }
  @Public()
  @ApiOperation({ summary: 'Recuperar JWT usando la cookie HttpOnly cmpc_session (7 días)' })
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async refresh(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response) {
    requireSessionHeader(req);
    try {
      return await this.auth.refresh(sessionCookie(req));
    } catch (error) {
      if (error instanceof UnauthorizedException) res.clearCookie(SESSION_COOKIE, cookieOptions());
      throw error;
    }
  }
  @Public()
  @ApiOperation({ summary: 'Revocar sesión persistente y eliminar su cookie' })
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('logout')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async logout(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response) {
    requireSessionHeader(req);
    const result = await this.auth.logout(sessionCookie(req));
    res.clearCookie(SESSION_COOKIE, cookieOptions());
    return result;
  }
}
