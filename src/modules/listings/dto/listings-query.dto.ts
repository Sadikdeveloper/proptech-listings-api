import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { SORT_DIRECTIONS, SortDirection } from '../../../common/types/api.types';
import {
  LISTING_SORT_FIELDS,
  LISTING_TYPES,
  ListingSortField,
  ListingType,
  MAX_BEDROOMS,
  MAX_PRICE,
} from '../listings.types';

export class ListingsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: LISTING_TYPES, example: 'rent' })
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsIn(LISTING_TYPES, { message: `type must be one of: ${LISTING_TYPES.join(', ')}` })
  @IsOptional()
  type?: ListingType;

  @ApiPropertyOptional({ minimum: 0, maximum: MAX_PRICE, example: 500 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_PRICE)
  @IsOptional()
  minPrice?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: MAX_PRICE, example: 5000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_PRICE)
  @IsOptional()
  maxPrice?: number;

  /** Exact bedroom count. */
  @ApiPropertyOptional({ minimum: 0, maximum: MAX_BEDROOMS, example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_BEDROOMS)
  @IsOptional()
  bedrooms?: number;

  /** Lower bound, useful for "3 bedrooms or more". */
  @ApiPropertyOptional({ minimum: 0, maximum: MAX_BEDROOMS, example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_BEDROOMS)
  @IsOptional()
  minBedrooms?: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID('4')
  @IsOptional()
  agentId?: string;

  @ApiPropertyOptional({
    enum: LISTING_SORT_FIELDS,
    description: 'Defaults to createdAt, or to distance when lat/lng are supplied',
  })
  @IsIn(LISTING_SORT_FIELDS)
  @IsOptional()
  sortBy?: ListingSortField;

  @ApiPropertyOptional({ enum: SORT_DIRECTIONS, default: 'desc' })
  @IsIn(SORT_DIRECTIONS)
  @IsOptional()
  sortOrder: SortDirection = 'desc';
}
