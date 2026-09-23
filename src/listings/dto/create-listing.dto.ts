import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsIn,
  IsInt,
  IsISO4217CurrencyCode,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  LISTING_TYPES,
  ListingType,
  MAX_BEDROOMS,
  MAX_PRICE,
} from '../listings.types';
import { GeoPointDto } from './geo-point.dto';

const DEFAULT_CURRENCY = 'USD';

export class CreateListingDto {
  @ApiProperty({ example: '3 bedroom flat in Ikoyi', minLength: 3, maxLength: 140 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(3, 140)
  title: string;

  @ApiPropertyOptional({ example: 'Renovated duplex with a private garden.', maxLength: 2000 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 2500.5, minimum: 0.01, maximum: MAX_PRICE })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'price must be greater than 0' })
  @Max(MAX_PRICE)
  price: number;

  @ApiPropertyOptional({ enum: LISTING_TYPES, default: 'rent', example: 'rent' })
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsIn(LISTING_TYPES, { message: `type must be one of: ${LISTING_TYPES.join(', ')}` })
  type: ListingType;

  @ApiProperty({ example: 3, minimum: 0, maximum: MAX_BEDROOMS })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_BEDROOMS)
  bedrooms: number;

  @ApiProperty({ type: GeoPointDto })
  @IsDefined({ message: 'location is required' })
  @ValidateNested()
  @Type(() => GeoPointDto)
  location: GeoPointDto;

  @ApiProperty({ format: 'uuid', example: '8f14e45f-ceea-467a-9a1f-2b2b2b2b2b2b' })
  @IsUUID('4', { message: 'agentId must be a valid UUID' })
  agentId: string;

  @ApiPropertyOptional({ enum: ['USD', 'EUR', 'GBP', 'NGN'], default: DEFAULT_CURRENCY })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsISO4217CurrencyCode({ message: 'currency must be a valid ISO 4217 currency code' })
  @IsOptional()
  currency: string = DEFAULT_CURRENCY;
}
