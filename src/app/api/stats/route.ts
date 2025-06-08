import { NextResponse } from 'next/server';
import { Resource } from 'sst';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// Helper function to get today's date string
function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

// Helper function to get date string for N days ago
function getDateString(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

export async function GET() {
  try {
    const today = getTodayDateString();
    
    // Get all provisions to analyze provider network
    const provisionsCommand = new ScanCommand({
      TableName: Resource.ProvisionsTable.name
    });
    const provisionsResult = await dynamodb.send(provisionsCommand);
    const provisions = provisionsResult.Items || [];

    // Get provision pool counts for each service type
    const [llmPools, embeddingsPools, scrapingPools, ttsPools] = await Promise.all([
      dynamodb.send(new ScanCommand({ TableName: Resource.LLMProvisionPoolTable.name })),
      dynamodb.send(new ScanCommand({ TableName: Resource.EmbeddingsProvisionPoolTable.name })),
      dynamodb.send(new ScanCommand({ TableName: Resource.ScrapingProvisionPoolTable.name })),
      dynamodb.send(new ScanCommand({ TableName: Resource.TTSProvisionPoolTable.name }))
    ]);

    // Get user count
    const usersCommand = new ScanCommand({
      TableName: Resource.UserTable.name,
      Select: "COUNT"
    });
    const usersResult = await dynamodb.send(usersCommand);

    // Get provider count  
    const providersCommand = new ScanCommand({
      TableName: Resource.ProviderTable.name,
      Select: "COUNT"
    });
    const providersResult = await dynamodb.send(providersCommand);

    // Get today's metadata for endpoints
    const endpointsToCheck = ['/chat/completions', '/embeddings', '/tts', '/scrape'];
    const metadataPromises = endpointsToCheck.map(endpoint =>
      dynamodb.send(new QueryCommand({
        TableName: Resource.MetadataTable.name,
        KeyConditionExpression: 'endpoint = :endpoint AND dayTimestamp = :date',
        ExpressionAttributeValues: {
          ':endpoint': endpoint,
          ':date': today
        }
      }))
    );
    
    const metadataResults = await Promise.all(metadataPromises);

    // Process provision data for analytics
    const providersByRegion: Record<string, number> = {};
    const providersByTier: Record<string, number> = {};
    const totalVRAM = { total: 0, available: 0 };
    
    provisions.forEach(provision => {
      // Geographic distribution
      const country = provision.location?.country || 'Unknown';
      providersByRegion[country] = (providersByRegion[country] || 0) + 1;
      
      // Hardware tier distribution
      const vram = provision.deviceDiagnostics?.compute?.gpu?.memory || 0;
      let tier = 'Basic (Tier 0)';
      if (vram >= 22528) tier = 'Mariana Depth (Tier 4)';
      else if (vram >= 8192) tier = 'Open Ocean (Tier 3)';
      else if (vram >= 4096) tier = 'Blue Surf (Tier 2)';
      else if (vram >= 1024) tier = 'Tide Pool (Tier 1)';
      
      providersByTier[tier] = (providersByTier[tier] || 0) + 1;
      
      // VRAM aggregation
      totalVRAM.total += vram;
      totalVRAM.available += Math.max(0, vram * 0.8); // Assume 80% available
    });

    // Process provision pools for live provider counts per endpoint/model
    const liveProvidersByEndpoint: Record<string, Record<string, number>> = {
      'chat': {},
      'embeddings': {},
      'tts': {},
      'scraping': { 'scraping': scrapingPools.Items?.length || 0 }
    };

    // Group LLM provisions by model
    llmPools.Items?.forEach(item => {
      const model = item.model as string;
      liveProvidersByEndpoint.chat[model] = (liveProvidersByEndpoint.chat[model] || 0) + 1;
    });

    // Group embeddings provisions by model
    embeddingsPools.Items?.forEach(item => {
      const model = item.model as string;
      liveProvidersByEndpoint.embeddings[model] = (liveProvidersByEndpoint.embeddings[model] || 0) + 1;
    });

    // Group TTS provisions by model
    ttsPools.Items?.forEach(item => {
      const model = item.model as string;
      liveProvidersByEndpoint.tts[model] = (liveProvidersByEndpoint.tts[model] || 0) + 1;
    });

    // Process endpoint performance from metadata
    interface EndpointStat {
      requestsToday: number;
      avgLatency: number;
      successRate: number;
      tokensPerSecond?: number;
      inputTokens?: number;
      outputTokens?: number;
    }
    const endpointStats: Record<string, EndpointStat> = {};
    endpointsToCheck.forEach((endpoint, index) => {
      const data = metadataResults[index].Items?.[0];
      endpointStats[endpoint] = {
        requestsToday: data?.totalNumRequests || 0,
        avgLatency: data?.averageLatency || 0,
        successRate: 99.5, // Placeholder - would need error tracking
        ...(data?.LLM && {
          tokensPerSecond: data.LLM.averageTps || 0,
          inputTokens: data.LLM.tokensIn || 0,
          outputTokens: data.LLM.tokensOut || 0
        })
      };
    });

    // Calculate network health metrics
    const totalProvisions = provisions.length;
    const activeProvisions = (llmPools.Items?.length || 0) + 
                            (embeddingsPools.Items?.length || 0) + 
                            (scrapingPools.Items?.length || 0) + 
                            (ttsPools.Items?.length || 0);
    
    const networkHealth = totalProvisions > 0 ? (activeProvisions / totalProvisions * 100) : 0;

    // Get growth data for the last 7 days (simplified)
    const last7Days = Array.from({ length: 7 }, (_, i) => getDateString(i)).reverse();
    
    // Aggregate response
    const statsData = {
      overview: {
        totalUsers: usersResult.Count || 0,
        totalProviders: providersResult.Count || 0,
        activeProvisions,
        totalProvisions,
        networkHealth: Math.round(networkHealth * 10) / 10,
        requestsToday: Object.values(endpointStats).reduce((sum: number, stat: EndpointStat) => sum + stat.requestsToday, 0)
      },
      
      providerNetwork: {
        geographic: providersByRegion,
        hardwareTiers: providersByTier,
        capacity: {
          totalVRAM: Math.round(totalVRAM.total / 1024), // Convert to GB
          availableVRAM: Math.round(totalVRAM.available / 1024),
          estimatedRPM: activeProvisions * 100 // Rough estimate
        },
        liveProvidersByEndpoint
      },
      
      serviceAnalytics: {
        endpointStats,
        popularModels: {
          chat: Object.entries(liveProvidersByEndpoint.chat)
            .sort(([,a], [,b]) => (b as number) - (a as number))
            .slice(0, 5),
          embeddings: Object.entries(liveProvidersByEndpoint.embeddings)
            .sort(([,a], [,b]) => (b as number) - (a as number))
            .slice(0, 5),
          tts: Object.entries(liveProvidersByEndpoint.tts)
            .sort(([,a], [,b]) => (b as number) - (a as number))
            .slice(0, 5)
        }
      },
      
      trends: {
        last7Days,
        // These would be populated by querying historical data
        providerGrowth: [], // Placeholder for growth data
        usageGrowth: [], // Placeholder for usage growth
        newRegions: Math.max(0, Object.keys(providersByRegion).length - 10) // Rough estimate
      },
      
      lastUpdated: new Date().toISOString()
    };

    return NextResponse.json(statsData);
    
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 