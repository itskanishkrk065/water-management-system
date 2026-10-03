import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { GeographicScopeService } from './geographic-scope.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, GeographicScopeService],
  exports: [UsersService, GeographicScopeService],
})
export class UsersModule {}
