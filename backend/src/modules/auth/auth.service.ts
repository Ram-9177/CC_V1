import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService
  ) {}

  async validateUser(hallticket: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByHallticket(hallticket);
    if (!user) return null;
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return null;
    return user;
  }

  async login(user: User) {
    const payload = { sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET
    });

    const refreshToken = this.jwtService.sign({ sub: user.id }, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    });

    // Update lastLoginAt
    await this.usersService.update(user.id, { lastLoginAt: new Date() } as Partial<User>);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        hallticket: user.hallticket,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePhoto: user.profilePhoto
      }
    };
  }

  async refreshToken(token: string) {
    try {
      const decoded = this.jwtService.verify(token, { secret: process.env.JWT_REFRESH_SECRET });
      const user = await this.usersService.findById(decoded.sub);
      if (!user) throw new UnauthorizedException();
      const payload = { sub: user.id, role: user.role };
      const accessToken = this.jwtService.sign(payload, { secret: process.env.JWT_SECRET });
      return { accessToken };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
