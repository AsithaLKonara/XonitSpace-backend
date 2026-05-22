import { IsNumber, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { SalaryStatus } from '@prisma/client';

export class SalaryDto {
  @IsUUID()
  employeeId!: string;

  @IsNumber()
  basicSalary!: number;

  @IsOptional()
  @IsNumber()
  allowances?: number;

  @IsOptional()
  @IsNumber()
  deductions?: number;
}
