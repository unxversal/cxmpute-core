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
    /* ─── DEX DynamoDB tables ──────────────────────────────────────────────── */
    const ordersTable = new sst.aws.Dynamo("OrdersTable", {
      fields: {
        pk:        "string",          // MARKET#BTC-PERP
        sk:        "string",          // TS#<uuid>
        traderId:  "string",
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      globalIndexes: {
        ByTrader: { hashKey: "traderId", rangeKey: "pk" }
      },
      stream: "new-and-old-images",
    });

    const tradesTable = new sst.aws.Dynamo("TradesTable", {
      fields: {
        pk:       "string",
        sk:       "string",
        traderId: "string",
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      globalIndexes: {
        ByTrader: { hashKey: "traderId", rangeKey: "pk" }
      },
      stream: "new-and-old-images",
    });

    const positionsTable = new sst.aws.Dynamo("PositionsTable", {
      fields: {
        pk: "string",       // TRADER#uuid
        sk: "string",       // MARKET#BTC-PERP
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
    });

    const marketsTable = new sst.aws.Dynamo("MarketsTable", {
      fields: {
        pk:     "string",   // MARKET#BTC-PERP
        sk:     "string",   // META
        status: "string",
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      globalIndexes: {
        ByStatus: { hashKey: "status", rangeKey: "pk" },
      },
    });

    const pricesTable = new sst.aws.Dynamo("PricesTable", {
      fields: {
        pk: "string",   // ASSET#BTC
        sk: "string",   // TS#ISO
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      ttl: "expireAt",                 // optional 7‑day TTL
    });

    const statsIntradayTable = new sst.aws.Dynamo("StatsIntradayTable", {
      fields: {
        pk:      "string",
        sk:      "string",
        expireAt:"number",             // 48 h TTL
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      ttl: "expireAt",
    });

    const statsDailyTable = new sst.aws.Dynamo("StatsDailyTable", {
      fields: { pk: "string", sk: "string" },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
    });

    const statsLifetimeTable = new sst.aws.Dynamo("StatsLifetimeTable", {
      fields: { pk: "string", sk: "string" },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
    });

    const wsConnectionsTable = new sst.aws.Dynamo("WSConnectionsTable", {
      fields: {
        pk:       "string",            // WS#<connId>
        sk:       "string",            // META
        expireAt: "number",            // 24 h TTL
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      ttl: "expireAt",
    });

    /* ─── S3 lake for cold trade/metrics history ───────────────────────────── */
    const dataLakeBucket = new sst.aws.Bucket("DexDataLakeBucket", {
      versioning: true,
      cors: { allowMethods: ["GET", "PUT"] },
    });

    /* ─── SNS topic for real‑time fan‑out ─────────────────────────────── */
    const marketUpdatesTopic = new sst.aws.SnsTopic("MarketUpdatesTopic");

    /* ─── SQS FIFO order queues ──────────────────────────────────────── */
    const marketOrdersQueue  = new sst.aws.Queue("MarketOrdersQueue",  {
      fifo: { contentBasedDeduplication: true },
      visibilityTimeout: "30 seconds",
    });
    const optionsOrdersQueue = new sst.aws.Queue("OptionsOrdersQueue", {
      fifo: { contentBasedDeduplication: true },
      visibilityTimeout: "30 seconds",
    });
    const perpsOrdersQueue   = new sst.aws.Queue("PerpsOrdersQueue",   {
      fifo: { contentBasedDeduplication: true },
      visibilityTimeout: "30 seconds",
    });
    const futuresOrdersQueue = new sst.aws.Queue("FuturesOrdersQueue", {
      fifo: { contentBasedDeduplication: true },
      visibilityTimeout: "30 seconds",
    });

    /* ─── Dynamo Stream → router Fn → SQS ─────────────────────────────── */
    ordersTable.subscribe("OrdersStreamRouter",{
      handler: "dex/streams/ordersStreamRouter.handler",
      link: [
        marketOrdersQueue,
        optionsOrdersQueue,
        perpsOrdersQueue,
        futuresOrdersQueue,
      ],
    });

    /* ─── Matcher subscribers (one per queue) ─────────────────────────── */
    marketOrdersQueue.subscribe({
      handler: "dex/matchers/market.handler",
      link: [
        ordersTable,
        tradesTable,
        positionsTable,
        statsIntradayTable,
        statsLifetimeTable,
        marketsTable,
        wsConnectionsTable,
        marketUpdatesTopic,
      ],
      timeout: "60 seconds",
    }, {
      batch: { size: 10, window: "5 seconds" },
    });

    optionsOrdersQueue.subscribe({
      handler: "dex/matchers/options.handler",
      link: [
        ordersTable,
        tradesTable,
        positionsTable,
        statsIntradayTable,
        statsLifetimeTable,
        marketsTable,
        wsConnectionsTable,
        marketUpdatesTopic,
      ],
      timeout: "60 seconds",
    }, {
      batch: { size: 10, window: "5 seconds" },
    });

    perpsOrdersQueue.subscribe({
      handler: "dex/matchers/perps.handler",
      link: [
        ordersTable,
        tradesTable,
        positionsTable,
        statsIntradayTable,
        statsLifetimeTable,
        marketsTable,
        wsConnectionsTable,
        marketUpdatesTopic,
      ],
      timeout: "60 seconds",
    }, {
      batch: { size: 10, window: "5 seconds" },
    });

    futuresOrdersQueue.subscribe({
      handler: "dex/matchers/futures.handler",
      link: [
        ordersTable,
        tradesTable,
        positionsTable,
        statsIntradayTable,
        statsLifetimeTable,
        marketsTable,
        wsConnectionsTable,
        marketUpdatesTopic,
      ],
      timeout: "60 seconds",
    }, {
      batch: { size: 10, window: "5 seconds" },
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
        tradesTable,
        positionsTable,
        ordersTable,
        marketsTable,
        pricesTable,
        statsIntradayTable,
        statsDailyTable,
        statsLifetimeTable,
        wsConnectionsTable,
        dataLakeBucket,
      ]
    });
  },
});
