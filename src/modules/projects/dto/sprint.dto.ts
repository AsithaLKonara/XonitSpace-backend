import { IsString, IsDateString, IsOptional, IsEnum } from 'class-validator';
import { SprintStatus } from '@prisma/client';

export class SprintDto {
  @IsString()
  name!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsEnum(SprintStatus)
  status?: SprintStatus;
}
