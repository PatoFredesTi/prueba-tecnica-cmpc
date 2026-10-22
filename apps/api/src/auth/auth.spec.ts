import { AuthService, JwtGuard, AuthController } from './auth';
import { hash } from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
describe('AuthService', () => {
  let db: any, jwt: any, service: AuthService;
  beforeAll(async () => {
    const passwordHash = await hash('password', 4);
    db = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'u', email: 'admin@example.com', role: 'ADMIN', passwordHash }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      authSession: {
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn(),
      },
    };
    db.$transaction = jest.fn((fn) => fn(db));
    jwt = { signAsync: jest.fn().mockResolvedValue('jwt') };
    service = new AuthService(db, jwt);
  });
  it('emite un JWT sin exponer el hash y registra login', async () => {
    const result = await service.login(
      { email: 'ADMIN@example.com', password: 'password' },
      'request',
    );
    expect(result).toEqual({
      refreshToken: expect.stringMatching(/^[a-f0-9]{64}$/),
      expiresAt: expect.any(Date),
      accessToken: 'jwt',
      user: { id: 'u', email: 'admin@example.com', role: 'ADMIN' },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'LOGIN', actorId: 'u', requestId: 'request' }),
    });
  });
  it('guarda solo el hash del secreto y reemplaza la sesión anterior dentro de la transacción', async () => {
    const result = await service.login(
      { email: 'admin@example.com', password: 'password' },
      'r',
      'previous',
    );
    expect(db.authSession.create).toHaveBeenLastCalledWith({
      data: {
        tokenHash: createHash('sha256').update(result.refreshToken).digest('hex'),
        userId: 'u',
        expiresAt: result.expiresAt,
      },
    });
    expect(result.expiresAt.getTime() - Date.now()).toBeGreaterThan(6 * 86400000);
    expect(db.authSession.deleteMany).toHaveBeenCalledWith({
      where: { tokenHash: createHash('sha256').update('previous').digest('hex') },
    });
  });
  it('renueva el JWT con datos actuales y rechaza sesiones ausentes o vencidas', async () => {
    await expect(service.refresh()).rejects.toThrow(UnauthorizedException);
    db.authSession.findUnique.mockResolvedValueOnce(null);
    await expect(service.refresh('unknown')).rejects.toThrow(UnauthorizedException);
    db.authSession.findUnique.mockResolvedValueOnce({ expiresAt: new Date(0) });
    await expect(service.refresh('expired')).rejects.toThrow(UnauthorizedException);
    db.authSession.findUnique.mockResolvedValueOnce({
      expiresAt: new Date(Date.now() + 60000),
      user: { id: 'u', email: 'current@test.cl', role: 'ADMIN', passwordHash: 'secret' },
    });
    await expect(service.refresh('valid')).resolves.toEqual({
      accessToken: 'jwt',
      user: { id: 'u', email: 'current@test.cl', role: 'ADMIN' },
    });
  });
  it('revoca únicamente la sesión indicada y acepta logout sin cookie', async () => {
    db.authSession.deleteMany.mockClear();
    await expect(service.logout()).resolves.toEqual({ loggedOut: true });
    expect(db.authSession.deleteMany).not.toHaveBeenCalled();
    await service.logout('valid');
    expect(db.authSession.deleteMany).toHaveBeenCalledWith({
      where: { tokenHash: createHash('sha256').update('valid').digest('hex') },
    });
  });
  it('no revela si el correo existe', async () => {
    await expect(
      service.login({ email: 'admin@example.com', password: 'wrong' }, 'r'),
    ).rejects.toThrow('Correo o contraseña incorrectos');
    db.user.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.login({ email: 'absent@example.com', password: 'wrong' }, 'r'),
    ).rejects.toThrow('Correo o contraseña incorrectos');
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: { action: 'LOGIN_FAILED', entityType: 'User', requestId: 'r' },
    });
  });
  it('controlador delega con correlación', async () => {
    const controller = new AuthController(service);
    await expect(
      controller.login(
        { email: 'a@a.cl', password: 'password' },
        { requestId: 'r', headers: { 'x-session-request': '1' } } as any,
        { cookie: jest.fn() } as any,
      ),
    ).resolves.toHaveProperty('accessToken');
  });
});
describe('Cookies de sesión', () => {
  const cookie = 'a'.repeat(64);
  const req = {
    requestId: 'r',
    headers: {
      'x-session-request': '1',
      cookie: `other=value; cmpc_session=${cookie}; another=ok`,
    },
  } as any;
  const res = () => ({ cookie: jest.fn(), clearCookie: jest.fn() });
  it('exige la cabecera contra CSRF antes de operar', async () => {
    const controller = new AuthController({} as any);
    const request = { headers: {} } as any;
    await expect(
      controller.login({ email: 'a@b.cl', password: 'p' }, request, res() as any),
    ).rejects.toThrow('X-Session-Request');
    await expect(controller.refresh(request, res() as any)).rejects.toThrow('X-Session-Request');
    await expect(controller.logout(request, res() as any)).rejects.toThrow('X-Session-Request');
  });
  it('publica el secreto solo en cookie HttpOnly y permite Secure para HTTPS', async () => {
    const previous = process.env.SESSION_COOKIE_SECURE;
    process.env.SESSION_COOKIE_SECURE = 'true';
    try {
      const expiresAt = new Date(Date.now() + 1000);
      const auth = {
        login: jest
          .fn()
          .mockResolvedValue({ accessToken: 'jwt', user: {}, refreshToken: cookie, expiresAt }),
      };
      const controller = new AuthController(auth as any),
        response = res();
      await expect(
        controller.login({ email: 'a@b.cl', password: 'p' }, req, response as any),
      ).resolves.toEqual({ accessToken: 'jwt', user: {} });
      expect(response.cookie).toHaveBeenCalledWith('cmpc_session', cookie, {
        httpOnly: true,
        sameSite: 'strict',
        secure: true,
        path: '/api/v1/auth',
        expires: expiresAt,
      });
    } finally {
      if (previous === undefined) delete process.env.SESSION_COOKIE_SECURE;
      else process.env.SESSION_COOKIE_SECURE = previous;
    }
  });
  it('borra cookie inválida pero la conserva ante errores transitorios del servidor', async () => {
    const auth = {
      refresh: jest
        .fn()
        .mockResolvedValueOnce({ accessToken: 'jwt' })
        .mockRejectedValueOnce(new UnauthorizedException())
        .mockRejectedValueOnce(new Error('database unavailable')),
    };
    const controller = new AuthController(auth as any),
      response = res();
    await expect(controller.refresh(req, response as any)).resolves.toEqual({ accessToken: 'jwt' });
    expect(auth.refresh).toHaveBeenCalledWith(cookie);
    await expect(controller.refresh(req, response as any)).rejects.toThrow(UnauthorizedException);
    expect(response.clearCookie).toHaveBeenCalledTimes(1);
    await expect(controller.refresh(req, response as any)).rejects.toThrow('database unavailable');
    expect(response.clearCookie).toHaveBeenCalledTimes(1);
  });
  it('elimina cookie después de revocar en el servidor', async () => {
    const auth = { logout: jest.fn().mockResolvedValue({ loggedOut: true }) };
    const controller = new AuthController(auth as any),
      response = res();
    await expect(controller.logout(req, response as any)).resolves.toEqual({ loggedOut: true });
    expect(auth.logout).toHaveBeenCalledWith(cookie);
    expect(response.clearCookie).toHaveBeenCalledWith(
      'cmpc_session',
      expect.objectContaining({ httpOnly: true, path: '/api/v1/auth' }),
    );
  });
});
describe('JwtGuard', () => {
  const ctx = (authorization?: string) => {
    const req: any = { headers: { authorization } };
    return {
      req,
      context: {
        getHandler: () => null,
        getClass: () => null,
        switchToHttp: () => ({ getRequest: () => req }),
      } as any,
    };
  };
  it('permite endpoints públicos', async () => {
    const guard = new JwtGuard({ getAllAndOverride: () => true } as any, {} as any);
    expect(await guard.canActivate(ctx().context)).toBe(true);
  });
  it('rechaza anónimos, tokens inválidos y expirados', async () => {
    const jwt = new JwtService({ secret: 'test-secret' }),
      guard = new JwtGuard({ getAllAndOverride: () => false } as any, jwt);
    await expect(guard.canActivate(ctx().context)).rejects.toThrow();
    await expect(guard.canActivate(ctx('Bearer bad').context)).rejects.toThrow();
    const expired = jwt.sign({ sub: 'user' }, { expiresIn: -1 });
    await expect(guard.canActivate(ctx(`Bearer ${expired}`).context)).rejects.toThrow();
    const noSubject = jwt.sign({ email: 'a' });
    await expect(guard.canActivate(ctx(`Bearer ${noSubject}`).context)).rejects.toThrow();
  });
  it('asocia el usuario de un token válido', async () => {
    const jwt = new JwtService({ secret: 'test-secret' }),
      guard = new JwtGuard({ getAllAndOverride: () => false } as any, jwt),
      c = ctx(`Bearer ${jwt.sign({ sub: 'user' })}`);
    expect(await guard.canActivate(c.context)).toBe(true);
    expect(c.req.user.sub).toBe('user');
  });
});
