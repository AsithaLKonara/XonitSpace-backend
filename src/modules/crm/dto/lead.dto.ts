import { IsString, IsNumber, IsUUID, IsEnum, IsOptional } from 'class-validator';
import { LeadStage } from '@prisma/client';

export class LeadDto {
  @IsString()
  title!: string;

  @IsNumber()
  value!: number;

  @IsUUID()
  customerId!: string;

  @IsOptional()
  @IsEnum(LeadStage)
  stage?: LeadStage;
}
