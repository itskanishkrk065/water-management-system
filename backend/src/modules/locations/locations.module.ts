import { Module } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { LocationImportService } from './location-import.service';
import { LocationsController } from './locations.controller';
import { AdminLocationImportController } from './admin-location-import.controller';

@Module({
  controllers: [LocationsController, AdminLocationImportController],
  providers: [LocationsService, LocationImportService],
  exports: [LocationsService, LocationImportService],
})
export class LocationsModule {}
