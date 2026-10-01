import { getDatabase } from '../db/database';
import { District, Block, Village, ProjectScheme } from '../types/domain';

export class LocationRepository {
  async getDistricts(): Promise<District[]> {
    const db = await getDatabase();
    return await db.getAllAsync<District>('SELECT * FROM districts ORDER BY name ASC;');
  }

  async getBlocksByDistrict(districtId: string): Promise<Block[]> {
    const db = await getDatabase();
    return await db.getAllAsync<Block>(
      'SELECT * FROM blocks WHERE district_id = ? ORDER BY name ASC;',
      [districtId]
    );
  }

  async getVillagesByBlock(blockId: string): Promise<Village[]> {
    const db = await getDatabase();
    return await db.getAllAsync<Village>(
      'SELECT * FROM villages WHERE block_id = ? ORDER BY name ASC;',
      [blockId]
    );
  }

  async getProjects(): Promise<ProjectScheme[]> {
    const db = await getDatabase();
    return await db.getAllAsync<ProjectScheme>(
      'SELECT * FROM project_schemes WHERE is_active = 1 ORDER BY project_name ASC;'
    );
  }
}
