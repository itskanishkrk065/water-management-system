import { getDatabase } from '../db/database';
import { District, Block, Panchayat, Village, ProjectScheme } from '../types/domain';

export class LocationRepository {
  /**
   * Get all active districts
   */
  async getDistricts(): Promise<District[]> {
    const db = await getDatabase();
    return await db.getAllAsync<District>(
      'SELECT * FROM districts WHERE is_active = 1 ORDER BY name ASC;'
    );
  }

  /**
   * Get blocks / taluks by district ID
   */
  async getBlocksByDistrict(districtId: string): Promise<Block[]> {
    const db = await getDatabase();
    return await db.getAllAsync<Block>(
      'SELECT * FROM blocks WHERE district_id = ? AND is_active = 1 ORDER BY name ASC;',
      [districtId]
    );
  }

  /**
   * Get Panchayats by district ID
   */
  async getPanchayatsByDistrict(districtId: string): Promise<Panchayat[]> {
    const db = await getDatabase();
    return await db.getAllAsync<Panchayat>(
      'SELECT * FROM panchayats WHERE district_id = ? ORDER BY name ASC;',
      [districtId]
    );
  }

  /**
   * Get Villages by block ID
   */
  async getVillagesByBlock(blockId: string): Promise<Village[]> {
    const db = await getDatabase();
    return await db.getAllAsync<Village>(
      'SELECT * FROM villages WHERE block_id = ? AND is_active = 1 ORDER BY name ASC;',
      [blockId]
    );
  }

  /**
   * Get Villages by panchayat ID
   */
  async getVillagesByPanchayat(panchayatId: string): Promise<Village[]> {
    const db = await getDatabase();
    return await db.getAllAsync<Village>(
      'SELECT * FROM villages WHERE panchayat_id = ? AND is_active = 1 ORDER BY name ASC;',
      [panchayatId]
    );
  }

  /**
   * Get all villages with district & block names
   */
  async getAllVillages(): Promise<(Village & { district_name?: string; block_name?: string })[]> {
    const db = await getDatabase();
    const sql = `
      SELECT v.*, blk.name as block_name, d.name as district_name 
      FROM villages v
      LEFT JOIN blocks blk ON v.block_id = blk.block_id
      LEFT JOIN districts d ON blk.district_id = d.district_id
      WHERE v.is_active = 1
      ORDER BY v.name ASC;
    `;
    return await db.getAllAsync<Village & { district_name?: string; block_name?: string }>(sql);
  }

  /**
   * Get active project schemes
   */
  async getProjects(): Promise<ProjectScheme[]> {
    const db = await getDatabase();
    return await db.getAllAsync<ProjectScheme>(
      'SELECT * FROM project_schemes WHERE is_active = 1 ORDER BY project_name ASC;'
    );
  }
}
