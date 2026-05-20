import { Injectable, ConflictException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // ─── Private Helper ─────────────────────────────────────────────────────────

  private generateTokenPair(user: { id: string; email: string; role: string }) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRATION || '1h',
    } as any);

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d',
    } as any);

    return { accessToken, refreshToken };
  }

  // ─── Register ────────────────────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('A user with this email address already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role || 'EMPLOYEE',
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
    });

    // Auto-create employee profile for staff roles
    if (['EMPLOYEE', 'PROJECT_MANAGER', 'HR_MANAGER', 'ACCOUNTANT'].includes(user.role)) {
      await this.prisma.employee.create({
        data: {
          userId: user.id,
          jobTitle: user.role.replace('_', ' '),
          department: 'Engineering',
        },
      });
    }

    return user;
  }

  // ─── Login ───────────────────────────────────────────────────────────────────

  async login(dto: LoginDto, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const { accessToken, refreshToken } = this.generateTokenPair(user);

    // Persist refresh token as a session (7 day TTL)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt,
        ipAddress: ipAddress || null,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'USER_LOGIN',
        details: { email: user.email },
        ipAddress: ipAddress || null,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  // ─── Refresh Token Rotation ───────────────────────────────────────────────────

  async refreshTokens(token: string) {
    const session = await this.prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!session.user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    try {
      this.jwtService.verify(token, {
        secret: process.env.JWT_REFRESH_SECRET,
      } as any);
    } catch {
      throw new UnauthorizedException('Invalid refresh token signature');
    }

    // Rotate: delete old session, issue new pair
    await this.prisma.session.delete({ where: { token } });

    const { accessToken, refreshToken: newRefreshToken } = this.generateTokenPair(session.user);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.session.create({
      data: {
        userId: session.user.id,
        token: newRefreshToken,
        expiresAt,
      },
    });

    return { accessToken, refreshToken: newRefreshToken };
  }

  // ─── Logout ──────────────────────────────────────────────────────────────────

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      await this.prisma.session.deleteMany({
        where: { token: refreshToken, userId },
      });
    } else {
      await this.prisma.session.deleteMany({ where: { userId } });
    }

    await this.prisma.activityLog.create({
      data: { userId, action: 'USER_LOGOUT' },
    });

    return { message: 'Logged out successfully' };
  }

  // ─── Profile ─────────────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { employee: true },
    });

    if (!user) throw new NotFoundException('User profile not found');

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      employeeProfile: user.employee,
      createdAt: user.createdAt,
    };
  }
}
