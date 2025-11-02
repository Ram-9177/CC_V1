import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60 } })
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.validateUser(dto.hallticket, dto.password);
    if (!user) return { status: 401, message: 'Invalid credentials' };
    return this.authService.login(user);
  }

  @Post('refresh')
  @Throttle({ default: { limit: 10, ttl: 60 } })
  async refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refreshToken(body.refreshToken);
  }

  @Post('logout')
  async logout(@Req() _req: Request) {
    // Stateless JWT: frontend should drop tokens. Extend to blacklist if needed.
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  async me(@Req() req: Request) {
    // Very small helper: parse bearer token and return decoded user info
    const auth = req.headers.authorization;
    if (!auth) return null;
    const token = auth.replace('Bearer ', '');
    try {
      const payload = await this.authService['jwtService'].verifyAsync(token, { secret: process.env.JWT_SECRET });
      return { id: payload.sub, role: payload.role };
    } catch {
      return null;
    }
  }
}
