import { IsString, IsNumber, IsOptional, IsUUID } from 'class-validator';

export class TimeLogDto {
  @IsUUID()
  employeeId!: string;

  @IsNumber()
  hours!: number;

  @IsOptional()
  @IsString()
  description?: string;
}
