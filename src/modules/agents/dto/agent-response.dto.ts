import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AgentEntity } from '../agents.types';

export class AgentResponseDto implements AgentEntity {
  @ApiProperty({ format: 'uuid', example: '1f3f1e4a-0d0f-4f4a-9d0f-1a2b3c4d5e6f' })
  id: string;

  @ApiProperty({ example: 'Ada Obi' })
  name: string;

  @ApiProperty({ example: 'ada.obi@agency.com' })
  email: string;

  @ApiProperty({ nullable: true, example: '+2348031234567' })
  phone: string | null;

  @ApiPropertyOptional({ example: 12, description: 'Number of listings owned by the agent' })
  listingsCount?: number;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

export class AgentSummaryDto implements Pick<AgentEntity, 'id' | 'name' | 'email' | 'phone'> {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Ada Obi' })
  name: string;

  @ApiProperty({ example: 'ada.obi@agency.com' })
  email: string;

  @ApiProperty({ nullable: true, example: '+2348031234567' })
  phone: string | null;
}
