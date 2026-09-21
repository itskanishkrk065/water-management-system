import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateExtensionRequestDto {
  @ApiProperty({ example: 'UUID of Beneficiary' })
  @IsUUID()
  @IsNotEmpty()
  beneficiaryId: string;

  @ApiProperty({ example: 'UUID of Original Water Allotment' })
  @IsUUID()
  @IsNotEmpty()
  originalAllotmentId: string;

  @ApiProperty({ example: 2.0000, description: 'Requested additional land in acres' })
  @IsNumber()
  @Min(0.0001)
  @IsNotEmpty()
  requestedAdditionalArea: number;

  @ApiProperty({ example: 20000, description: 'Requested additional water in litres' })
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  requestedAdditionalLitres: number;

  @ApiProperty({ example: 'Expanded cultivation into adjacent subdivision', required: false })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class ApproveExtensionDto {
  @ApiProperty({ example: 2.0000, description: 'Approved additional land in acres' })
  @IsNumber()
  @Min(0.0001)
  @IsNotEmpty()
  approvedAdditionalArea: number;

  @ApiProperty({ example: 20000, description: 'Approved additional litres' })
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  approvedAdditionalLitres: number;

  @ApiProperty({ example: 'Extension approved per regional water council review', required: false })
  @IsOptional()
  @IsString()
  remarks?: string;
}
