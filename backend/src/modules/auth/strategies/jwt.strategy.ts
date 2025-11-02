import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'keyboardcat'
    });
  }

  async validate(payload: any) {
    // payload: { sub: userId, role: ... }
    const user = await this.usersService.findById(payload.sub);
    if (!user) return null;
    // attach minimal user info
    return { id: user.id, role: user.role, hallticket: user.hallticket };
  }
}
