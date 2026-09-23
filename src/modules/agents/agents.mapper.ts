import { AgentEntity, AgentRecord, AgentRecordWithCount } from './agents.types';

export const AGENT_SUMMARY_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
} as const;

export function toAgentEntity(record: AgentRecord | AgentRecordWithCount): AgentEntity {
  const counts = (record as AgentRecordWithCount)._count;

  return {
    id: record.id,
    name: record.name,
    email: record.email,
    phone: record.phone,
    ...(counts ? { listingsCount: counts.listings } : {}),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
