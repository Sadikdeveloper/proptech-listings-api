import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export const PHONE_PATTERN = /^\+?[0-9][0-9\s\-()]{6,31}$/;

export class CreateAgentDto {
  @ApiProperty({ example: 'Ada Obi', minLength: 2, maxLength: 120 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 120)
  name: string;

  @ApiProperty({ example: 'ada.obi@agency.com', maxLength: 160 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(160)
  email: string;

  @ApiPropertyOptional({ example: '+2348031234567', maxLength: 32 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(PHONE_PATTERN, { message: 'phone must be a valid phone number' })
  @IsOptional()
  phone?: string;
}
