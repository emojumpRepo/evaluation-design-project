import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { sign, verify, SignOptions } from 'jsonwebtoken';
import { StringValue } from 'ms';
import { UserService } from './user.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {}
  async generateToken({ _id, username }: { _id: string; username: string }) {
    const secret = this.configService.get<string>('XIAOJU_SURVEY_JWT_SECRET');
    const expiresIn: StringValue = this.configService.get<StringValue>(
      'XIAOJU_SURVEY_JWT_EXPIRES_IN',
    );
    const signOptions: SignOptions = {
      expiresIn,
    };
    return sign({ _id, username }, secret, signOptions);
  }

  async generateAdminToken() {
    const adminUsername = this.configService.get<string>(
      'ADMIN_USERNAME',
      'admin',
    );
    const adminPassword = this.configService.get<string>(
      'ADMIN_PASSWORD',
      '123456',
    );
    const user = await this.userService.getUser({
      username: adminUsername,
      password: adminPassword,
    });
    if (!user) {
      throw new Error('管理员账号不存在或密码错误');
    }
    const secret = this.configService.get<string>('XIAOJU_SURVEY_JWT_SECRET');
    // 不设置 expiresIn，永久有效
    return sign({ _id: user._id.toString(), username: user.username }, secret);
  }

  async verifyToken(token: string) {
    let decoded;
    try {
      decoded = verify(
        token,
        this.configService.get<string>('XIAOJU_SURVEY_JWT_SECRET'),
      );
    } catch (err) {
      throw new Error('用户凭证错误');
    }
    const user = await this.userService.getUserByUsername(decoded.username);
    if (!user) {
      throw new Error('用户不存在');
    }
    return user;
  }
}
