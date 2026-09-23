import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { MAX_RADIUS_KM, MIN_RADIUS_KM } from '../../../common/geo/geo.util';
import { ListingsQueryDto } from './listings-query.dto';

export const DEFAULT_RADIUS_KM = 5;

export class SearchListingsQueryDto extends ListingsQueryDto {
  @ApiPropertyOptional({ description: 'Latitude of the search centre', example: 6.4281 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  @IsOptional()
  lat?: number;

  @ApiPropertyOptional({ description: 'Longitude of the search centre', example: 3.4219 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  @IsOptional()
  lng?: number;

  @ApiPropertyOptional({
    description: 'Radius in kilometres around lat/lng (ignored without a centre)',
    minimum: MIN_RADIUS_KM,
    maximum: MAX_RADIUS_KM,
    default: DEFAULT_RADIUS_KM,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(MIN_RADIUS_KM)
  @Max(MAX_RADIUS_KM)
  @IsOptional()
  radiusKm?: number;
}
