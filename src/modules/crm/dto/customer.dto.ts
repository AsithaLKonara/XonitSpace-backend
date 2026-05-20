import { IsEmail, IsString, IsOptional } from 'class-validator';

export class CustomerDto {
  @IsString()
  companyName!: string;

  @IsString()
  contactName!: string;

  @IsEmail({}, { message: 'Invalid customer email address' })
  contactEmail!: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;
}
