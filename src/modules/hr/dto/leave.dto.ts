import { IsDateString, IsString, IsEnum } from 'class-validator';
import { LeaveType } from '@prisma/client';

export class LeaveDto {
  @IsEnum(LeaveType, { message: 'Invalid leave type' })
  type!: LeaveType;

  @IsDateString({}, { message: 'Start date must be a valid ISO date' })
  startDate!: string;

  @IsDateString({}, { message: 'End date must be a valid ISO date' })
  endDate!: string;

  @IsString()
  reason!: string;
}
