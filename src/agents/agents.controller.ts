import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponses } from '../common/decorators/api-error-responses.decorator';
import { ApiPaginatedResponse } from '../common/decorators/api-paginated-response.decorator';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { AgentQueryDto } from './dto/agent-query.dto';
import { AgentResponseDto } from './dto/agent-response.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';

@ApiTags('agents')
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an agent' })
  @ApiBody({ type: CreateAgentDto })
  @ApiCreatedResponse({ type: AgentResponseDto, description: 'Agent created' })
  @ApiErrorResponses(400, 409)
  create(@Body() dto: CreateAgentDto): Promise<AgentResponseDto> {
    return this.agentsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List agents with pagination and optional search' })
  @ApiPaginatedResponse(AgentResponseDto)
  @ApiErrorResponses(400)
  findAll(@Query() query: AgentQueryDto) {
    return this.agentsService.findAll(
      { search: query.search, sortBy: query.sortBy, sortOrder: query.sortOrder },
      { page: query.page, limit: query.limit },
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch a single agent' })
  @ApiOkResponse({ type: AgentResponseDto })
  @ApiErrorResponses(400, 404)
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<AgentResponseDto> {
    return this.agentsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an agent' })
  @ApiBody({ type: UpdateAgentDto })
  @ApiOkResponse({ type: AgentResponseDto })
  @ApiErrorResponses(400, 404, 409)
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateAgentDto,
  ): Promise<AgentResponseDto> {
    return this.agentsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an agent (only when they have no listings)' })
  @ApiErrorResponses(400, 404, 409)
  async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<void> {
    await this.agentsService.remove(id);
  }
}
