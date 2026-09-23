import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsNumber } from 'class-validator';

export class GeoPointDto {
  @ApiProperty({ example: 6.4281, minimum: -90, maximum: 90 })
  @Type(() => Number)
  @IsNumber()
  @IsLatitude({ message: 'location.latitude must be a valid latitude between -90 and 90' })
  latitude: number;

  @ApiProperty({ example: 3.4219, minimum: -180, maximum: 180 })
  @Type(() => Number)
  @IsNumber()
  @IsLongitude({ message: 'location.longitude must be a valid longitude between -180 and 180' })
  longitude: number;
}
