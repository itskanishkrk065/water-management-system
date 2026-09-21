import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMode } from '@prisma/client';

export class RecordPaymentDto {
  @ApiProperty({ example: 'UUID of Beneficiary' })
  @IsUUID()
  @IsNotEmpty()
  beneficiaryId: string;

  @ApiProperty({ example: 'UUID of Installment', required: false })
  @IsOptional()
  @IsUUID()
  installmentId?: string;

  @ApiProperty({ example: 'UUID of RunningBill', required: false })
  @IsOptional()
  @IsUUID()
  runningBillId?: string;

  @ApiProperty({ example: 'UUID of Extension', required: false })
  @IsOptional()
  @IsUUID()
  extensionId?: string;

  @ApiProperty({ example: 2250.00, description: 'Amount paid in INR' })
  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  amount: number;

  @ApiProperty({ enum: PaymentMode, example: PaymentMode.UPI })
  @IsEnum(PaymentMode)
  @IsNotEmpty()
  paymentMode: PaymentMode;

  @ApiProperty({ example: 'UPI-REF-987654321', required: false })
  @IsOptional()
  @IsString()
  paymentReference?: string;

  @ApiProperty({ example: '2026-09-21T12:00:00.000Z', required: false })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @ApiProperty({ example: 'First installment payment received via GPay', required: false })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class ReversePaymentDto {
  @ApiProperty({ example: 'Cheque bounced or duplicate payment entry' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
