import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';

@ApiTags('Global Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('global')
  @ApiOperation({ summary: 'Execute unified global search across beneficiaries, land, water, billing, and payments' })
  async globalSearch(
    @Query('q') query: string,
    @Query('limit') limit: string,
    @CurrentUser() user: RequestUser,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 8;
    return this.searchService.globalSearch(query, user.role as any, limitNum);
  }
}
