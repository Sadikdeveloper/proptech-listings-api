import { Agent } from '@prisma/client';
import { PaginatedResult, SortDirection } from '../../common/types/api.types';

export interface AgentEntity {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  listingsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export const AGENT_SORT_FIELDS = ['createdAt', 'updatedAt', 'name', 'email'] as const;
export type AgentSortField = (typeof AGENT_SORT_FIELDS)[number];

export interface AgentListFilters {
  search?: string;
  sortBy: AgentSortField;
  sortOrder: SortDirection;
}

export type AgentRecord = Agent;
export type AgentRecordWithCount = Agent & { _count: { listings: number } };

export type PaginatedAgents = PaginatedResult<AgentEntity>;
