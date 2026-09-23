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
import { ApiErrorResponses } from '../../common/decorators/api-error-responses.decorator';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { ListingQueryValidationPipe } from '../../common/pipes/listing-query-validation.pipe';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListingResponseDto } from './dto/listing-response.dto';
import { ListingsQueryDto } from './dto/listings-query.dto';
import { SearchListingsQueryDto } from './dto/search-listings-query.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingsService } from './listings.service';

@ApiTags('listings')
@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a listing' })
  @ApiBody({ type: CreateListingDto })
  @ApiCreatedResponse({ type: ListingResponseDto })
  @ApiErrorResponses(400, 404)
  create(@Body() dto: CreateListingDto): Promise<ListingResponseDto> {
    return this.listingsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List listings with filters and pagination' })
  @ApiPaginatedResponse(ListingResponseDto)
  @ApiErrorResponses(400)
  findAll(@Query(ListingQueryValidationPipe) query: ListingsQueryDto) {
    return this.listingsService.findAll(query);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search listings by attributes and/or radius',
    description:
      'Pass lat and lng (plus an optional radiusKm, default 5) to get only listings inside that ' +
      'circle, sorted by distance. Each result then carries `distanceKm`.',
  })
  @ApiPaginatedResponse(ListingResponseDto)
  @ApiErrorResponses(400)
  search(@Query(ListingQueryValidationPipe) query: SearchListingsQueryDto) {
    return this.listingsService.search(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch a single listing' })
  @ApiOkResponse({ type: ListingResponseDto })
  @ApiErrorResponses(400, 404)
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<ListingResponseDto> {
    return this.listingsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a listing' })
  @ApiBody({ type: UpdateListingDto })
  @ApiOkResponse({ type: ListingResponseDto })
  @ApiErrorResponses(400, 404)
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateListingDto,
  ): Promise<ListingResponseDto> {
    return this.listingsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a listing' })
  @ApiErrorResponses(400, 404)
  async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<void> {
    await this.listingsService.remove(id);
  }
}
