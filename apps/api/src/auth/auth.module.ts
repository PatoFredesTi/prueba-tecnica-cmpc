import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { securityConfig } from '../security/config';
import { AuthController, AuthService, JwtGuard } from './auth';
@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 10 }],
      errorMessage: 'Demasiados intentos. Espera un minuto y vuelve a intentar.',
    }),
    JwtModule.registerAsync({
      useFactory: () => {
        const { secret } = securityConfig();
        const expiresIn = process.env.JWT_EXPIRES_IN || '1h';
        if (!/^\d+[smhd]$/.test(expiresIn))
          throw new Error('JWT_EXPIRES_IN debe usar un número seguido por s, m, h o d');
        return {
          secret,
          signOptions: {
            expiresIn: expiresIn as `${number}h`,
            algorithm: 'HS256',
            issuer: 'cmpc-libros',
            audience: 'cmpc-web',
          },
          verifyOptions: { algorithms: ['HS256'], issuer: 'cmpc-libros', audience: 'cmpc-web' },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, { provide: APP_GUARD, useClass: JwtGuard }],
})
export class AuthModule {}
