import { ConflictException, NotFoundException } from '@nestjs/common';
import { AgentsService } from '../../src/modules/agents/agents.service';
import { PrismaService } from '../../src/modules/prisma/prisma.service';

const AGENT_ID = '3f1a8e42-2f4e-4b4a-9f3e-1c2b3a4d5e6f';

function agentRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: AGENT_ID,
    name: 'Ada Obi',
    email: 'ada@agency.example',
    phone: '+2348031234567',
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    updatedAt: new Date('2026-01-01T10:00:00.000Z'),
    _count: { listings: 0 },
    ...overrides,
  };
}

describe('AgentsService', () => {
  let service: AgentsService;
  let prisma: {
    agent: Record<'create' | 'findUnique' | 'findMany' | 'count' | 'update' | 'delete', jest.Mock>;
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      agent: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    service = new AgentsService(prisma as unknown as PrismaService);
  });

  it('creates an agent and exposes the listing count', async () => {
    prisma.agent.findUnique.mockResolvedValue(null);
    prisma.agent.create.mockResolvedValue(agentRecord());

    const result = await service.create({ name: 'Ada Obi', email: 'ada@agency.example' });

    expect(result).toEqual({
      id: AGENT_ID,
      name: 'Ada Obi',
      email: 'ada@agency.example',
      phone: '+2348031234567',
      listingsCount: 0,
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-01-01T10:00:00.000Z',
    });
  });

  it('rejects a duplicate email before hitting the database constraint', async () => {
    prisma.agent.findUnique.mockResolvedValue({ id: AGENT_ID });

    await expect(service.create({ name: 'Ada', email: 'ada@agency.example' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.agent.create).not.toHaveBeenCalled();
  });

  it('allows an agent to keep their own email on update', async () => {
    prisma.agent.findUnique
      .mockResolvedValueOnce(agentRecord())
      .mockResolvedValueOnce({ id: AGENT_ID });
    prisma.agent.update.mockResolvedValue(agentRecord({ name: 'Ada O.' }));

    const result = await service.update(AGENT_ID, { name: 'Ada O.', email: 'ada@agency.example' });

    expect(result.name).toBe('Ada O.');
  });

  it('throws 404 when the agent does not exist', async () => {
    prisma.agent.findUnique.mockResolvedValue(null);

    await expect(service.findOne(AGENT_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses to delete an agent that still owns listings', async () => {
    prisma.agent.findUnique.mockResolvedValue(agentRecord({ _count: { listings: 2 } }));

    await expect(service.remove(AGENT_ID)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.agent.delete).not.toHaveBeenCalled();
  });

  it('deletes an agent without listings', async () => {
    prisma.agent.findUnique.mockResolvedValue(agentRecord());

    await service.remove(AGENT_ID);

    expect(prisma.agent.delete).toHaveBeenCalledWith({ where: { id: AGENT_ID } });
  });

  it('searches names and emails case-insensitively and paginates', async () => {
    prisma.$transaction.mockResolvedValue([[agentRecord()], 1]);

    const result = await service.findAll(
      { search: 'ada', sortBy: 'name', sortOrder: 'asc' },
      { page: 1, limit: 20 },
    );

    expect(prisma.agent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: expect.any(Array) },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take: 20,
        skip: 0,
      }),
    );
    expect(result.meta.total).toBe(1);
  });

  it('reports whether an agent exists', async () => {
    prisma.agent.findUnique.mockResolvedValue({ id: AGENT_ID });
    await expect(service.exists(AGENT_ID)).resolves.toBe(true);

    prisma.agent.findUnique.mockResolvedValue(null);
    await expect(service.exists(AGENT_ID)).resolves.toBe(false);
  });
});
