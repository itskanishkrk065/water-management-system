import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMode } from '../../common/enums';

export class RecordPaymentDto {
  @ApiProperty({ example: 'UUID of Beneficiary', required: false })
  @IsOptional()
  @IsUUID()
  beneficiaryId?: string;

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

  @ApiProperty({ enum: PaymentMode, example: PaymentMode.CASH, required: false })
  @IsOptional()
  @IsEnum(PaymentMode)
  paymentMode?: PaymentMode;

  @ApiProperty({ enum: PaymentMode, example: PaymentMode.CASH, required: false })
  @IsOptional()
  @IsEnum(PaymentMode)
  paymentMethod?: PaymentMode;

  @ApiProperty({ example: 'UPI-REF-987654321', required: false })
  @IsOptional()
  @IsString()
  paymentReference?: string;

  @ApiProperty({ example: 'UPI-REF-987654321', required: false })
  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @ApiProperty({ example: 'Officer John Doe', required: false })
  @IsOptional()
  @IsString()
  collectorName?: string;

  @ApiProperty({ example: 'Officer John Doe', required: false })
  @IsOptional()
  @IsString()
  collector?: string;

  @ApiProperty({ example: '2026-09-21T12:00:00.000Z', required: false })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @ApiProperty({ example: 'First installment payment received', required: false })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiProperty({ example: 'First installment payment received', required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ example: 'IDEMP-12345', required: false })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class ReversePaymentDto {
  @ApiProperty({ example: 'Cheque bounced or duplicate payment entry' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
