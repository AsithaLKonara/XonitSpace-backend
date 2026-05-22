import { IsEmail, IsString, IsOptional, MaxLength } from 'class-validator';

export class CustomerDto {
  @IsString()
  @MaxLength(255, { message: 'Company name is too long (max 255 characters)' })
  companyName!: string;

  @IsString()
  @MaxLength(100, { message: 'Contact name is too long (max 100 characters)' })
  contactName!: string;

  @IsEmail({}, { message: 'Invalid customer email address' })
  contactEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30, { message: 'Phone number is too long (max 30 characters)' })
  contactPhone?: string;
}

