import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AgentSummaryDto } from '../../agents/dto/agent-response.dto';
import { LISTING_TYPES, ListingEntity, ListingType } from '../listings.types';
import { GeoPointDto } from './geo-point.dto';

export class ListingResponseDto implements ListingEntity {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '3 bedroom flat in Ikoyi' })
  title: string;

  @ApiProperty({ nullable: true, example: 'Renovated duplex with a private garden.' })
  description: string | null;

  @ApiProperty({ example: 2500.5, description: 'Asking price in `currency`' })
  price: number;

  @ApiProperty({ example: 'USD' })
  currency: string;

  @ApiProperty({ enum: LISTING_TYPES, example: 'rent' })
  type: ListingType;

  @ApiProperty({ example: 3 })
  bedrooms: number;

  @ApiProperty({ format: 'uuid' })
  agentId: string;

  @ApiProperty({ type: GeoPointDto })
  location: GeoPointDto;

  @ApiPropertyOptional({
    example: 1.284,
    description: 'Distance from the search centre in km (only on /listings/search)',
  })
  distanceKm?: number;

  @ApiPropertyOptional({ type: AgentSummaryDto })
  agent?: AgentSummaryDto;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}
