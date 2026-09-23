import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { SORT_DIRECTIONS, SortDirection } from '../../../common/types/api.types';
import { AGENT_SORT_FIELDS, AgentSortField } from '../agents.types';

export class AgentQueryDto extends PaginationQueryDto {
  /** Case-insensitive match against name or email. */
  @ApiPropertyOptional({ example: 'ada', maxLength: 120 })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: AGENT_SORT_FIELDS, default: 'createdAt' })
  @IsIn(AGENT_SORT_FIELDS)
  @IsOptional()
  sortBy: AgentSortField = 'createdAt';

  @ApiPropertyOptional({ enum: SORT_DIRECTIONS, default: 'desc' })
  @IsIn(SORT_DIRECTIONS)
  @IsOptional()
  sortOrder: SortDirection = 'desc';
}
