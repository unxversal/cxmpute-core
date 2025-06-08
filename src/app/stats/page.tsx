'use client';

import React, { useState, useEffect } from 'react';
import { Activity, Server, Globe, Zap, Users, TrendingUp, Cpu, HardDrive, Wifi } from 'lucide-react';
import styles from './stats.module.css';

interface StatsData {
  overview: {
    totalUsers: number;
    totalProviders: number;
    activeProvisions: number;
    totalProvisions: number;
    networkHealth: number;
    requestsToday: number;
  };
  providerNetwork: {
    geographic: Record<string, number>;
    hardwareTiers: Record<string, number>;
    capacity: {
      totalVRAM: number;
      availableVRAM: number;
      estimatedRPM: number;
    };
    liveProvidersByEndpoint: {
      chat: Record<string, number>;
      embeddings: Record<string, number>;
      tts: Record<string, number>;
      scraping: Record<string, number>;
    };
  };
  serviceAnalytics: {
    endpointStats: Record<string, {
      requestsToday: number;
      avgLatency: number;
      successRate: number;
      tokensPerSecond?: number;
      inputTokens?: number;
      outputTokens?: number;
    }>;
    popularModels: {
      chat: [string, number][];
      embeddings: [string, number][];
      tts: [string, number][];
    };
  };
  trends: {
    last7Days: string[];
    providerGrowth: number[];
    usageGrowth: number[];
    newRegions: number;
  };
  lastUpdated: string;
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

const formatLatency = (ms: number): string => {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
};

export default function StatsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Activity className={styles.loadingSpinner} size={48} />
        <h2>Loading Cxmpute Network Stats...</h2>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className={styles.errorContainer}>
        <h2>Unable to load statistics</h2>
        <p>{error}</p>
        <button onClick={fetchStats} className={styles.retryButton}>
          Retry
        </button>
      </div>
    );
  }

  const topRegions = Object.entries(stats.providerNetwork.geographic)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);

  return (
    <div className={styles.statsContainer}>
      <header className={styles.header}>
        <h1>Cxmpute Network Statistics</h1>
        <div className={styles.lastUpdated}>
          <Activity size={16} />
          Last updated: {lastRefresh?.toLocaleTimeString()}
        </div>
      </header>

      {/* Real-time Overview */}
      <section className={styles.overviewSection}>
        <h2>Real-time Overview</h2>
        <div className={styles.overviewGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <Server size={24} />
            </div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{formatNumber(stats.overview.activeProvisions)}</div>
              <div className={styles.statLabel}>Active Providers</div>
              <div className={styles.statSubtext}>
                {stats.overview.totalProvisions} total registered
              </div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <Users size={24} />
            </div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{formatNumber(stats.overview.totalUsers)}</div>
              <div className={styles.statLabel}>Total Users</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <Activity size={24} />
            </div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{formatNumber(stats.overview.requestsToday)}</div>
              <div className={styles.statLabel}>Requests Today</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <Wifi size={24} />
            </div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{stats.overview.networkHealth}%</div>
              <div className={styles.statLabel}>Network Health</div>
            </div>
          </div>
        </div>
      </section>

      {/* Provider Network */}
      <section className={styles.networkSection}>
        <h2>Provider Network</h2>
        
        <div className={styles.networkGrid}>
          {/* Geographic Distribution */}
          <div className={styles.networkCard}>
            <h3><Globe size={20} /> Geographic Distribution</h3>
            <div className={styles.regionList}>
              {topRegions.map(([country, count]) => (
                <div key={country} className={styles.regionItem}>
                  <span className={styles.regionName}>{country}</span>
                  <span className={styles.regionCount}>{count} providers</span>
                  <div className={styles.regionBar}>
                    <div 
                      className={styles.regionProgress}
                      style={{ 
                        width: `${(count / topRegions[0][1]) * 100}%` 
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hardware Tiers */}
          <div className={styles.networkCard}>
            <h3><Cpu size={20} /> Hardware Tiers</h3>
            <div className={styles.tierList}>
              {Object.entries(stats.providerNetwork.hardwareTiers).map(([tier, count]) => (
                <div key={tier} className={styles.tierItem}>
                  <span className={styles.tierName}>{tier}</span>
                  <span className={styles.tierCount}>{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Capacity Metrics */}
          <div className={styles.networkCard}>
            <h3><HardDrive size={20} /> Network Capacity</h3>
            <div className={styles.capacityStats}>
              <div className={styles.capacityStat}>
                <span className={styles.capacityLabel}>Total VRAM</span>
                <span className={styles.capacityValue}>{stats.providerNetwork.capacity.totalVRAM}GB</span>
              </div>
              <div className={styles.capacityStat}>
                <span className={styles.capacityLabel}>Available VRAM</span>
                <span className={styles.capacityValue}>{stats.providerNetwork.capacity.availableVRAM}GB</span>
              </div>
              <div className={styles.capacityStat}>
                <span className={styles.capacityLabel}>Est. Capacity</span>
                <span className={styles.capacityValue}>{formatNumber(stats.providerNetwork.capacity.estimatedRPM)} RPM</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Providers by Endpoint/Model */}
      <section className={styles.liveProvidersSection}>
        <h2>Live Providers by Service</h2>
        
        <div className={styles.servicesGrid}>
          {/* Chat/LLM Models */}
          <div className={styles.serviceCard}>
            <h3>💬 Chat Models</h3>
            <div className={styles.modelList}>
              {Object.entries(stats.providerNetwork.liveProvidersByEndpoint.chat).length > 0 ? (
                Object.entries(stats.providerNetwork.liveProvidersByEndpoint.chat)
                  .sort(([,a], [,b]) => b - a)
                  .map(([model, count]) => (
                    <div key={model} className={styles.modelItem}>
                      <span className={styles.modelName}>{model}</span>
                      <span className={styles.modelCount}>{count} providers</span>
                    </div>
                  ))
              ) : (
                <div className={styles.noProviders}>No active providers</div>
              )}
            </div>
          </div>

          {/* Embeddings Models */}
          <div className={styles.serviceCard}>
            <h3>🔍 Embeddings</h3>
            <div className={styles.modelList}>
              {Object.entries(stats.providerNetwork.liveProvidersByEndpoint.embeddings).length > 0 ? (
                Object.entries(stats.providerNetwork.liveProvidersByEndpoint.embeddings)
                  .sort(([,a], [,b]) => b - a)
                  .map(([model, count]) => (
                    <div key={model} className={styles.modelItem}>
                      <span className={styles.modelName}>{model}</span>
                      <span className={styles.modelCount}>{count} providers</span>
                    </div>
                  ))
              ) : (
                <div className={styles.noProviders}>No active providers</div>
              )}
            </div>
          </div>

          {/* TTS Models */}
          <div className={styles.serviceCard}>
            <h3>🗣️ Text-to-Speech</h3>
            <div className={styles.modelList}>
              {Object.entries(stats.providerNetwork.liveProvidersByEndpoint.tts).length > 0 ? (
                Object.entries(stats.providerNetwork.liveProvidersByEndpoint.tts)
                  .sort(([,a], [,b]) => b - a)
                  .map(([model, count]) => (
                    <div key={model} className={styles.modelItem}>
                      <span className={styles.modelName}>{model}</span>
                      <span className={styles.modelCount}>{count} providers</span>
                    </div>
                  ))
              ) : (
                <div className={styles.noProviders}>No active providers</div>
              )}
            </div>
          </div>

          {/* Scraping Service */}
          <div className={styles.serviceCard}>
            <h3>🌐 Web Scraping</h3>
            <div className={styles.modelList}>
              <div className={styles.modelItem}>
                <span className={styles.modelName}>Scraping Service</span>
                <span className={styles.modelCount}>
                  {stats.providerNetwork.liveProvidersByEndpoint.scraping.scraping || 0} providers
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Service Analytics */}
      <section className={styles.analyticsSection}>
        <h2>Service Performance</h2>
        
        <div className={styles.endpointsGrid}>
          {Object.entries(stats.serviceAnalytics.endpointStats).map(([endpoint, data]) => (
            <div key={endpoint} className={styles.endpointCard}>
              <h3>{endpoint}</h3>
              <div className={styles.endpointStats}>
                <div className={styles.endpointStat}>
                  <span className={styles.statLabel}>Requests Today</span>
                  <span className={styles.statValue}>{formatNumber(data.requestsToday)}</span>
                </div>
                <div className={styles.endpointStat}>
                  <span className={styles.statLabel}>Avg Latency</span>
                  <span className={styles.statValue}>{formatLatency(data.avgLatency)}</span>
                </div>
                <div className={styles.endpointStat}>
                  <span className={styles.statLabel}>Success Rate</span>
                  <span className={styles.statValue}>{data.successRate}%</span>
                </div>
                {data.tokensPerSecond && (
                  <div className={styles.endpointStat}>
                    <span className={styles.statLabel}>Tokens/sec</span>
                    <span className={styles.statValue}>{data.tokensPerSecond.toFixed(1)}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Growth Metrics */}
      <section className={styles.growthSection}>
        <h2>Growth & Trends</h2>
        
        <div className={styles.growthGrid}>
          <div className={styles.growthCard}>
            <h3><TrendingUp size={20} /> Network Expansion</h3>
            <div className={styles.growthStats}>
              <div className={styles.growthStat}>
                <span className={styles.growthLabel}>Total Providers</span>
                <span className={styles.growthValue}>{stats.overview.totalProviders}</span>
              </div>
              <div className={styles.growthStat}>
                <span className={styles.growthLabel}>Coverage</span>
                <span className={styles.growthValue}>{Object.keys(stats.providerNetwork.geographic).length} countries</span>
              </div>
              <div className={styles.growthStat}>
                <span className={styles.growthLabel}>New Regions</span>
                <span className={styles.growthValue}>{stats.trends.newRegions} this month</span>
              </div>
            </div>
          </div>

          <div className={styles.growthCard}>
            <h3><Zap size={20} /> Platform Health</h3>
            <div className={styles.healthStats}>
              <div className={styles.healthStat}>
                <span className={styles.healthLabel}>Uptime</span>
                <span className={styles.healthValue}>99.2%</span>
              </div>
              <div className={styles.healthStat}>
                <span className={styles.healthLabel}>Provider Availability</span>
                <span className={styles.healthValue}>{stats.overview.networkHealth}%</span>
              </div>
              <div className={styles.healthStat}>
                <span className={styles.healthLabel}>Response Quality</span>
                <span className={styles.healthValue}>High</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <p>
          Data refreshes every 30 seconds • Built with ❤️ by the Cxmpute team
        </p>
        <p>
          Last updated: {new Date(stats.lastUpdated).toLocaleString()}
        </p>
      </footer>
    </div>
  );
} 