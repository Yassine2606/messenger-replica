import jwt from 'jsonwebtoken';
import { User } from '../models';
import { config } from '../config';
import { AppError } from '../middleware';

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: Partial<User>;
  token: string;
}

export class AuthService {
  public async register(data: RegisterData): Promise<AuthResponse> {
    const existingUser = await User.findOne({ where: { email: data.email } });
    if (existingUser) {
      throw new AppError(400, 'Email already registered');
    }

    const user = await User.create(data);
    const token = this.generateToken(user.id);

    return {
      user: user.toJSON(),
      token,
    };
  }

  public async login(data: LoginData): Promise<AuthResponse> {
    const user = await User.findOne({ where: { email: data.email } });
    if (!user) {
      throw new AppError(401, 'Invalid credentials');
    }

    const isValidPassword = await user.comparePassword(data.password);
    if (!isValidPassword) {
      throw new AppError(401, 'Invalid credentials');
    }

    user.lastSeen = new Date();
    await user.save();

    const token = this.generateToken(user.id);

    return {
      user: user.toJSON(),
      token,
    };
  }

  public async getProfile(userId: number): Promise<Partial<User>> {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new AppError(404, 'User not found');
    }
    return user.toJSON();
  }

  public async updateProfile(
    userId: number,
    data: Partial<Pick<User, 'name' | 'avatarUrl' | 'status'>>
  ): Promise<Partial<User>> {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new AppError(404, 'User not found');
    }

    if (data.name) user.name = data.name;
    if (data.avatarUrl !== undefined) user.avatarUrl = data.avatarUrl;
    if (data.status !== undefined) user.status = data.status;

    await user.save();
    return user.toJSON();
  }

  public verifyToken(token: string): { userId: number } {
    try {
      if (!config.jwt.secret) {
        throw new Error('JWT secret is not defined');
      }
      const decoded = jwt.verify(token, config.jwt.secret) as jwt.JwtPayload;
      if (!decoded || typeof decoded !== 'object' || !decoded.userId) {
        throw new AppError(401, 'Invalid or expired token');
      }
      return { userId: decoded.userId };
    } catch {
      throw new AppError(401, 'Invalid or expired token');
    }
  }

  private generateToken(userId: number): string {
    if (!config.jwt.secret) {
      throw new Error('JWT secret is not defined');
    }
    return jwt.sign({ userId }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);
  }
}

export const authService = new AuthService();
