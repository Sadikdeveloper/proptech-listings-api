import { INestApplication } from '@nestjs/common';
import request from 'supertest';

export interface AgentPayload {
  name: string;
  email: string;
  phone?: string;
}

export interface ListingPayload {
  title: string;
  description?: string;
  price: number;
  type?: 'rent' | 'sale' | 'shortlet';
  bedrooms: number;
  location: { latitude: number; longitude: number };
  agentId: string;
  currency?: string;
}

export function agentPayload(overrides: Partial<AgentPayload> = {}): AgentPayload {
  return {
    name: 'Ada Obi',
    email: `ada.${Math.random().toString(36).slice(2, 10)}@agency.example`,
    phone: '+2348031234567',
    ...overrides,
  };
}

export function listingPayload(agentId: string, overrides: Partial<ListingPayload> = {}): ListingPayload {
  return {
    title: '3 bedroom flat in Ikoyi',
    description: 'Renovated flat with a private garden.',
    price: 2500.5,
    type: 'rent',
    bedrooms: 3,
    location: { latitude: 6.4521, longitude: 3.4345 },
    agentId,
    ...overrides,
  };
}

export async function createAgent(
  app: INestApplication,
  overrides: Partial<AgentPayload> = {},
): Promise<{ id: string; email: string; name: string }> {
  const response = await request(app.getHttpServer())
    .post('/agents')
    .send(agentPayload(overrides))
    .expect(201);

  return response.body;
}

export async function createListing(
  app: INestApplication,
  agentId: string,
  overrides: Partial<ListingPayload> = {},
): Promise<Record<string, unknown>> {
  const response = await request(app.getHttpServer())
    .post('/listings')
    .send(listingPayload(agentId, overrides))
    .expect(201);

  return response.body;
}
