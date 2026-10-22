import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthController, AuthService, JwtGuard } from './auth';
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret || secret.length < 32)
          throw new Error('JWT_SECRET debe tener al menos 32 caracteres');
        const expiresIn = process.env.JWT_EXPIRES_IN || '1h';
        if (!/^\d+[smhd]$/.test(expiresIn))
          throw new Error('JWT_EXPIRES_IN debe usar un número seguido por s, m, h o d');
        return {
          secret,
          signOptions: {
            expiresIn: expiresIn as `${number}h`,
            issuer: 'cmpc-libros',
            audience: 'cmpc-web',
          },
          verifyOptions: { issuer: 'cmpc-libros', audience: 'cmpc-web' },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, { provide: APP_GUARD, useClass: JwtGuard }],
})
export class AuthModule {}
