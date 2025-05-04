// sst.config.ts
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "cxmpute-core",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
    };
  },
  async run() {

    // Provider Table
    const providerTable = new sst.aws.Dynamo("ProviderTable", {
      fields: {
        providerId: "string",
        providerEmail: "string",
        apiKey: "string",
        // provider wallet address: string
        // - rewards[] // rewards over the past 30 days
        //     - Day (timestamp)
        //     - Amount: number
        // - Total Rewards: number
      },
      primaryIndex: { hashKey: "providerId" },
      globalIndexes: {
        ByApiKey: { hashKey: "apiKey" },
        ByEmail: { hashKey: "providerEmail" }
      }
    });

    // Provisions Table
    const provisionsTable = new sst.aws.Dynamo("ProvisionsTable", {
      fields: {
        provisionId: "string",
        providerId: "string",
        // provision Specs: DeviceDiagnostics type
        // location: location object
      },
      primaryIndex: { hashKey: "provisionId" },
      globalIndexes: {
        ByProviderId: { hashKey: "providerId" }
      }
    });

    const authEmail = new sst.aws.Email("AuthEmail", {
      sender: "cxmpute.cloud",
    });

    // LLM Provision Pool Table
    const llmProvisionPoolTable = new sst.aws.Dynamo("LLMProvisionPoolTable", {
      fields: {
        provisionId: "string",
        model: "string",
        randomValue: "number", // float in [0..1)
        // provision endpoint: string, url used to make request to node and get response
        // location: location object
      },
      primaryIndex: { hashKey: "provisionId" },
      globalIndexes: {
        ByModel: { hashKey: "model" },
        ByModelRandom: { 
          hashKey: "model", 
          rangeKey: "randomValue" 
        }
      }
    });

    // Embeddings Provision Pool Table
    const embeddingsProvisionPoolTable = new sst.aws.Dynamo("EmbeddingsProvisionPoolTable", {
      fields: {
        provisionId: "string",
        model: "string",
        randomValue: "number", // float in [0..1)
        // provision endpoint: string, url used to make request to node and get response
        // location: location object
      },
      primaryIndex: { hashKey: "provisionId" },
      globalIndexes: {
        ByModel: { hashKey: "model" },
        ByModelRandom: { 
          hashKey: "model", 
          rangeKey: "randomValue" 
        }
      }
    });

    // Scraping Provision Pool Table
    const scrapingProvisionPoolTable = new sst.aws.Dynamo("ScrapingProvisionPoolTable", {
      fields: {
        provisionId: "string",
        randomValue: "number", // float in [0..1)
        // provision endpoint: string, url used to make request to node and get response
        // location: location object
      },
      primaryIndex: { hashKey: "provisionId" },
      globalIndexes: {
        ByRandom: { hashKey: "randomValue" }
      }
    });

    // Moon Provision Pool Table
    const moonProvisionPoolTable = new sst.aws.Dynamo("MoonProvisionPoolTable", {
      fields: {
        provisionId: "string",
        randomValue: "number", // float in [0..1)
        // provision endpoint: string, url used to make request to node and get response
        // location: location object
      },
      primaryIndex: { hashKey: "provisionId" },
      globalIndexes: {
        ByRandom: { hashKey: "randomValue" }
      }
    });

    // Video and Image Provision Pool Table
    const mediaProvisionPoolTable = new sst.aws.Dynamo("MediaProvisionPoolTable", {
      fields: {
        provisionId: "string",
        model: "string",
        type: "string", // "image" or "video"
        randomValue: "number", // float in [0..1)
        // provision endpoint: string, url used to make request to node and get response
        // location: location object
      },
      primaryIndex: { hashKey: "provisionId" },
      globalIndexes: {
        ByModelAndType: { hashKey: "model", rangeKey: "type" },
        ByType: { hashKey: "type" },
        ByModelAndTypeRandom: { 
          hashKey: "model", 
          rangeKey: "randomValue", 
        }
      }
    });

    // TTS Provision Pool Table
    const ttsProvisionPoolTable = new sst.aws.Dynamo("TTSProvisionPoolTable", {
      fields: {
        provisionId: "string",
        model: "string",
        randomValue: "number", // float in [0..1)
        // provision endpoint: string, url used to make request to node and get response
        // location: location object
      },
      primaryIndex: { hashKey: "provisionId" },
      globalIndexes: {
        ByModel: { hashKey: "model" },
        ByModelRandom: { 
          hashKey: "model", 
          rangeKey: "randomValue" 
        }
      }
    });

    // User Table
    const userTable = new sst.aws.Dynamo("UserTable", {
      fields: {
        userId: "string",
        userAk: "string",
        // api key: {key: string, creditLimit: number, creditsLeft: number}[]
        // credits: number
        // rewards: { day: string, amount: number }[]
        // - Total Rewards: number
      },
      primaryIndex: { hashKey: "userId" },
      globalIndexes: {
        ByWalletAddress: { hashKey: "userAk" },
      }
    });

    // Metadata Table
    const metadataTable = new sst.aws.Dynamo("MetadataTable", {
      fields: {
        endpoint: "string", // endpoint or model name
        dayTimestamp: "string",
        // llm?: { THis field exists for when the endpoint is a model
        //   model: string,
        //   tokensIn: number,
        //   tokensOut: number,
        //   averageTps: number,
        // }
        // totalNumRequests: number // incremented with each new request
        // averageLatency: number
      },
      primaryIndex: { hashKey: "endpoint", rangeKey: "dayTimestamp" }
    });

    // Service Metadata Table
    const serviceMetadataTable = new sst.aws.Dynamo("ServiceMetadataTable", {
      fields: {
        serviceName: "string",
        // attributes for each endpoint:
        // - Total num requests
        // - requests[] // past week max
        //    - Past day timestamp
        //    - Num requests: number
        // attributes for each model:
        // - Total input tokens
        // - Total output tokens
        //     - totals[] //past week max
              // - Past day timestamp
              // - Num input tokens: number
              // - Num output tokens: number
      },
      primaryIndex: { hashKey: "serviceName" }
    });

    // Network Stats Table
    const networkStatsTable = new sst.aws.Dynamo("NetworkStatsTable", {
      fields: {
        dateTimestamp: "string",
        endpointOrModel: "string",
        // current num provisions: number
        // provision tier: number
      },
      primaryIndex: { hashKey: "dateTimestamp", rangeKey: "endpointOrModel" },
      globalIndexes: {
        ByEndpointOrModel: { hashKey: "endpointOrModel", rangeKey: "dateTimestamp" }
      }
    });

    // Advertisement Table
    const advertisementTable = new sst.aws.Dynamo("AdvertisementTable", {
      fields: {
        timeSlotTimestamp: "string",
        location: "string",
        // content: string,
      },
      primaryIndex: { hashKey: "timeSlotTimestamp", rangeKey: "location" }
    });

    const graphs = new sst.aws.Bucket("GraphsBucket");

    const auth = new sst.aws.Auth("CxmputeAuth", {
      issuer: {
        handler: "auth/index.handler",
        link: [
          providerTable,
          userTable,
          authEmail,        // <-- makes Resource.AuthEmail.* available
        ],
      },
    });

    // ──────────────────────────────────────────────────────────────
    // DEX ‑ DynamoDB tables
    // ──────────────────────────────────────────────────────────────

    // All Order types (market/limit/option/perp/future)
    const ordersTable = new sst.aws.Dynamo("OrdersTable", {
      fields: {
        pk:        "string",   // MARKET#<symbol>
        sk:        "string",   // TS#<uuid>
        traderId:  "string",
        createdAt: "number",
        expireAt:  "number",
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      globalIndexes: {
        ByTrader: { hashKey: "traderId", rangeKey: "createdAt" },
      },
      ttl:   "expireAt",
      stream: "new-and-old-images",
    });

    // Raw trade fills (mirrors Orders PK/SK for easy joins)
    const tradesTable = new sst.aws.Dynamo("TradesTable", {
      fields: {
        pk:        "string",   // MARKET#<symbol>
        sk:        "string",   // TS#<uuid>
        traderId:  "string",
        createdAt: "number",
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      globalIndexes: {
        ByTrader: { hashKey: "traderId", rangeKey: "createdAt" },
      },
      stream: "keys-only",     // feed → Firehose → S3 lake
    });

    // Net position snapshot per trader × market
    const positionsTable = new sst.aws.Dynamo("PositionsTable", {
      fields: {
        pk: "string",          // TRADER#<uuid>
        sk: "string",          // MARKET#<symbol>
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
    });

    // Market metadata & status
    const marketsTable = new sst.aws.Dynamo("MarketsTable", {
      fields: {
        pk:     "string",      // MARKET#<symbol>
        sk:     "string",      // "META"
        status: "string",      // active | paused | expired
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      globalIndexes: {
        ByStatus: { hashKey: "status" },
      },
    });

    // Oracle snapshots
    const pricesTable = new sst.aws.Dynamo("PricesTable", {
      fields: {
        pk:        "string",   // ASSET#<symbol>
        sk:        "string",   // TS#<iso>
        expireAt:  "number",
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      ttl: "expireAt",
    });

    // 1‑min (or 5 s) hot stats
    const statsIntradayTable = new sst.aws.Dynamo("StatsIntradayTable", {
      fields: {
        pk:        "string",   // MARKET#<symbol>
        sk:        "string",   // 2025‑05‑03T17:05
        expireAt:  "number",
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      ttl: "expireAt",
    });

    // 24 h aggregates (warm tier)
    const statsDailyTable = new sst.aws.Dynamo("StatsDailyTable", {
      fields: {
        pk: "string",          // MARKET#<symbol>
        sk: "string",          // 2025‑05‑03
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
    });

    // WebSocket connection registry
    const wsConnectionsTable = new sst.aws.Dynamo("WsConnectionsTable", {
      fields: {
        pk:       "string",    // WS#<connectionId>
        sk:       "string",    // "META"
        expireAt: "number",
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      ttl: "expireAt",
    });

    // Trader profile (lightweight — extend as needed)
    const tradersTable = new sst.aws.Dynamo("TradersTable", {
      fields: {
        traderId:  "string",
        createdAt: "number",
      },
      primaryIndex: { hashKey: "traderId" },
    });


    // Link tables to the NextJS app
    new sst.aws.Nextjs("CxmputeSite", {
      domain: {
        name: "cxmpute.cloud",
        redirects: ["www." + "cxmpute.cloud"],
      },
      link: [
        providerTable,
        provisionsTable,
        llmProvisionPoolTable,
        embeddingsProvisionPoolTable,
        scrapingProvisionPoolTable,
        moonProvisionPoolTable,
        mediaProvisionPoolTable,
        ttsProvisionPoolTable,
        userTable,
        metadataTable,
        serviceMetadataTable,
        networkStatsTable,
        advertisementTable,
        auth,
        graphs,
        authEmail,
        positionsTable,
        marketsTable,
        pricesTable,
        statsIntradayTable,
        statsDailyTable,
        wsConnectionsTable,
        tradersTable,
        tradesTable,
        ordersTable,
      ]
    });
  },
});
