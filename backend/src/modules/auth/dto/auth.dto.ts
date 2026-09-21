import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@water.gov' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Admin@123456' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token provided during login' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class BeneficiarySignUpDto {
  @ApiProperty({ example: 'Murugan Velusamy' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: '9843210987' })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({ example: 'murugan@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Secret@123456' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'farmer@water.gov' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'farmer@water.gov' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'reset-token-123' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ example: 'NewSecret@123' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  newPassword: string;
}
