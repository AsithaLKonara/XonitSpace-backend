import { IsString, IsNumber, IsDateString, IsUUID, IsOptional } from 'class-validator';

export class InvoiceDto {
  @IsUUID()
  projectId!: string;

  @IsString()
  invoiceNumber!: string;

  @IsNumber()
  subtotal!: number;

  @IsOptional()
  @IsNumber()
  tax?: number;

  @IsOptional()
  @IsNumber()
  discount?: number;

  @IsDateString()
  dueDate!: string;
}
