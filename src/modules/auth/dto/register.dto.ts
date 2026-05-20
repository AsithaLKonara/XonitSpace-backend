import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { SystemRole } from '@prisma/client';

export class RegisterDto {
  @IsEmail({}, { message: 'Please enter a valid email address' })
  email!: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsEnum(SystemRole, { message: 'Invalid system role provided' })
  role?: SystemRole;
}
