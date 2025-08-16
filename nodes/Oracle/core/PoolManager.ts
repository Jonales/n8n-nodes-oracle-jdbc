import { EnterpriseConnectionPool, PoolStatistics } from './EnterpriseConnectionPool';
import { OracleJdbcConfig } from '../types/JdbcTypes';
import { AdvancedPoolConfiguration, PoolConfigurationPresets } from './AdvancedPoolConfig';

export class PoolManager {
  private static instance: PoolManager;
  private pools = new Map<string, EnterpriseConnectionPool>();

  private constructor() {}

  public static getInstance(): PoolManager {
    if (!PoolManager.instance) {
      PoolManager.instance = new PoolManager();
    }
    return PoolManager.instance;
  }

  async createPool(
    poolName: string,
    config: OracleJdbcConfig,
    poolConfig: AdvancedPoolConfiguration = {}
  ): Promise<string> {
    if (this.pools.has(poolName)) {
      throw new Error(`Pool ${poolName} already exists`);
    }

    const pool = new EnterpriseConnectionPool(config, poolConfig);
    await pool.initialize();
    
    this.pools.set(poolName, pool);
    return pool.getPoolId();
  }

  async createHighVolumeOLTPPool(
    poolName: string,
    config: OracleJdbcConfig
  ): Promise<string> {
    return this.createPool(poolName, config, PoolConfigurationPresets.getHighVolumeOLTP());
  }

  async createAnalyticsPool(
    poolName: string,
    config: OracleJdbcConfig
  ): Promise<string> {
    return this.createPool(poolName, config, PoolConfigurationPresets.getAnalyticsWorkload());
  }

  async createOracleCloudPool(
    poolName: string,
    config: OracleJdbcConfig
  ): Promise<string> {
    return this.createPool(poolName, config, PoolConfigurationPresets.getOracleCloudConfig());
  }

  getPool(poolName: string): EnterpriseConnectionPool {
    const pool = this.pools.get(poolName);
    if (!pool) {
      throw new Error(`Pool ${poolName} not found`);
    }
    return pool;
  }

  async getPoolStatistics(poolName: string): Promise<PoolStatistics> {
    const pool = this.getPool(poolName);
    return pool.getPoolStatistics();
  }

  async getAllPoolStatistics(): Promise<{ [poolName: string]: PoolStatistics }> {
    const stats: { [poolName: string]: PoolStatistics } = {};
    
    for (const [poolName, pool] of this.pools) {
      try {
        stats[poolName] = await pool.getPoolStatistics();
      } catch (error) {
        console.error(`Failed to get stats for pool ${poolName}:`, error.message);
      }
    }
    
    return stats;
  }

  async refreshPool(poolName: string): Promise<void> {
    const pool = this.getPool(poolName);
    await pool.refreshPool();
  }

  async closePool(poolName: string): Promise<void> {
    const pool = this.pools.get(poolName);
    if (pool) {
      await pool.close();
      this.pools.delete(poolName);
    }
  }

  async closeAllPools(): Promise<void> {
    for (const [poolName, pool] of this.pools) {
      try {
        await pool.close();
      } catch (error) {
        console.error(`Failed to close pool ${poolName}:`, error.message);
      }
    }
    this.pools.clear();
  }

  listPools(): string[] {
    return Array.from(this.pools.keys());
  }

  getPoolCount(): number {
    return this.pools.size;
  }
}
