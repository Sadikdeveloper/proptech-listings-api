import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginatedResult } from '../../common/types/api.types';
import { buildPaginationMeta, toSkip } from '../../common/utils/pagination.util';
import { PrismaService } from '../prisma/prisma.service';
import { AgentEntity, AgentListFilters } from './agents.types';
import { toAgentEntity } from './agents.mapper';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAgentDto): Promise<AgentEntity> {
    await this.assertEmailIsAvailable(dto.email);

    const agent = await this.prisma.agent.create({
      data: { name: dto.name, email: dto.email, phone: dto.phone ?? null },
      include: { _count: { select: { listings: true } } },
    });

    return toAgentEntity(agent);
  }

  async findAll(
    filters: AgentListFilters,
    { page, limit }: { page: number; limit: number },
  ): Promise<PaginatedResult<AgentEntity>> {
    const where: Prisma.AgentWhereInput = filters.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { email: { contains: filters.search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [records, total] = await this.prisma.$transaction([
      this.prisma.agent.findMany({
        where,
        orderBy: [{ [filters.sortBy]: filters.sortOrder }, { id: 'asc' }],
        skip: toSkip({ page, limit }),
        take: limit,
        include: { _count: { select: { listings: true } } },
      }),
      this.prisma.agent.count({ where }),
    ]);

    return {
      data: records.map(toAgentEntity),
      meta: buildPaginationMeta(total, { page, limit }),
    };
  }

  async findOne(id: string): Promise<AgentEntity> {
    const agent = await this.prisma.agent.findUnique({
      where: { id },
      include: { _count: { select: { listings: true } } },
    });

    if (!agent) {
      throw new NotFoundException(`Agent with id "${id}" was not found`);
    }

    return toAgentEntity(agent);
  }

  async update(id: string, dto: UpdateAgentDto): Promise<AgentEntity> {
    await this.findOne(id);

    if (dto.email) {
      await this.assertEmailIsAvailable(dto.email, id);
    }

    const agent = await this.prisma.agent.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      },
      include: { _count: { select: { listings: true } } },
    });

    return toAgentEntity(agent);
  }

  async remove(id: string): Promise<void> {
    const agent = await this.findOne(id);

    // Listings hold an agent reference with `onDelete: Restrict`; deleting would
    // orphan them, so the caller has to deal with the listings explicitly.
    if ((agent.listingsCount ?? 0) > 0) {
      throw new ConflictException(
        `Agent "${id}" still has ${agent.listingsCount} listing(s); reassign or delete them first`,
      );
    }

    await this.prisma.agent.delete({ where: { id } });
  }

  async exists(id: string): Promise<boolean> {
    const agent = await this.prisma.agent.findUnique({ where: { id }, select: { id: true } });
    return agent !== null;
  }

  private async assertEmailIsAvailable(email: string, ignoreId?: string): Promise<void> {
    const existing = await this.prisma.agent.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing && existing.id !== ignoreId) {
      throw new ConflictException(`An agent with email "${email}" already exists`);
    }
  }
}
