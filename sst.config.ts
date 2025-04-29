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

    /* ─────────────────────────────
    *  1. Core order-book resources
    * ────────────────────────────*/

    // 1-a. FIFO ingress queue
    const ordersQueue = new sst.aws.Queue("OrdersQueue", {
      fifo: { contentBasedDeduplication: true },
      visibilityTimeout: "30 seconds",
    });

    // 1-b. Off-chain → on-chain settlement queue
    const settlementQueue = new sst.aws.Queue("SettlementQueue");

    // 1-c. Dynamo tables
    const ordersTable = new sst.aws.Dynamo("OrdersTable", {
      fields: {
        pk: "string",                 // MARKET#BTC-USDC
        sk: "string",                 // SIDE#BUY#P=30000#TS=...
        userId: "string",
        price: "number",
        qty: "number",
        status: "string",             // NEW | PARTIAL | FILLED | CXL | EXP
        product: "string",            // SPOT | PERP | FUTURE | OPTION
        market: "string",
        ts: "number",
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      globalIndexes: {
        ByUser:    { hashKey: "userId", rangeKey: "sk" },
        ByStatus:  { hashKey: "status", rangeKey: "pk" },
      },
      stream: "new-and-old-images",
    });

    const tradesTable = new sst.aws.Dynamo("TradesTable", {
      fields: {
        pk: "string",                 // MARKET#BTC-USDC
        sk: "string",                 // TS#...#TID
        price: "number",
        qty: "number",
        buyOid: "string",
        sellOid: "string",
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
    });

    const positionsTable = new sst.aws.Dynamo("PositionsTable", {
      fields: {
        pk: "string",                 // USER#<uid>
        sk: "string",                 // MARKET#BTC-PERP
        size: "number",
        avgEntry: "number",
        realizedPnl: "number",
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
    });

    const marketsTable = new sst.aws.Dynamo("MarketsTable", {
      fields: {
        pk: "string",                 // MARKET#BTC-PERP
        sk: "string",                 // INFO or PRICE#TS
        indexPrice: "number",
        expiryTs: "number",
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
    });

    /* ─────────────────────────────
    *  2. Lambda consumers
    * ────────────────────────────*/

    // Matcher — deterministic crossing engine
    ordersQueue.subscribe({
      handler: "dex/match.handler",
      link:   [ordersTable, tradesTable, positionsTable, marketsTable, settlementQueue],
      timeout:"30 seconds",
    }, {
      batch:  { size: 10, window: "0 seconds" },
    });

    // Settlement — batches fills on-chain
    settlementQueue.subscribe({
      handler: "dex/settle.handler",
      link:   [tradesTable],
      timeout:"60 seconds",
    });

    // Depth & trade broadcasts (from Dynamo Streams)
    ordersTable.subscribe("DepthBroadcast", "dex/depthBroadcast.handler", {
      filters: [ { dynamodb: { NewImage: { status: { S: ["FILLED","PARTIAL"] } } } } ],
    });
    tradesTable.subscribe("TradeBroadcast", "dex/tradeBroadcast.handler");

    const connectionsTable = new sst.aws.Dynamo("ConnectionsTable", {
      fields: { connectionId: "string" },
      primaryIndex: { hashKey: "connectionId" },
    });

    /* ─────────────────────────────
    *  3. WebSocket API (real-time push)
    * ────────────────────────────*/
    const wsApi = new sst.aws.ApiGatewayWebSocket("DexWS", {
      transform: {
        route: {
          handler: {
            runtime: "nodejs20.x",
            link: [ordersTable, tradesTable, positionsTable, connectionsTable]
          }
        }
      }
    });

    wsApi.route("$connect",    "dex/ws/connect.handler");
    wsApi.route("$disconnect", "dex/ws/disconnect.handler");
    wsApi.route("depth",       "dex/ws/depth.handler");
    wsApi.route("trade",       "dex/ws/trade.handler");
    wsApi.route("pnl",         "dex/ws/pnl.handler");

    /* ─────────────────────────────
    *  4. Periodic jobs
    * ────────────────────────────*/
    new sst.aws.Cron("FundingCron", {
      schedule: "rate(1 hour)",
      function: "dex/cron/funding.handler",
    });

    new sst.aws.Cron("ExpiryCron", {
      schedule: "cron(0 0 * * ? *)", // midnight UTC
      function: "dex/cron/expiry.handler",
    });

    new sst.aws.Cron("OracleCron", {
      schedule: "rate(1 minute)",
      function: "dex/cron/oracle.handler",
    });    

    
    // Add this to your sst.config.ts run function
    const adminBus = new sst.aws.Bus("AdminBus");

    // Create an admin Lambda to process admin events
    const adminHandler = new sst.aws.Function("AdminHandler", {
      handler: "dex/admin/handler.default",
      link: [ordersTable, tradesTable, positionsTable, marketsTable, adminBus],
    });

    // Subscribe the handler to the bus
    adminBus.subscribe("AdminEvents", {
      handler: adminHandler.arn,
    }, {
      pattern: {
        source: ["admin.dex"],
      }
    });


    // Add this to your sst.config.ts run function
  const auditStream = new sst.aws.KinesisStream("AuditStream");

  // Add a consumer to export data to S3 (parquet format as mentioned in architecture)
  auditStream.subscribe("S3Exporter", {
    handler: "dex/audit/s3Export.handler"
  });

  new sst.aws.Cron("AuditIndexer", {
    function: "dex/audit/indexer.handler",
    schedule: "rate(5 minutes)",
  });
  

  // Don't forget to link the stream to the Next.js app and settlement Lambda
  settlementQueue.subscribe({
    handler: "dex/settle.handler",
    link: [tradesTable, auditStream], // Add auditStream here
    timeout: "60 seconds",
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
        ordersQueue, 
        settlementQueue,
        ordersTable, 
        tradesTable, 
        positionsTable, 
        marketsTable,
        wsApi,
        connectionsTable,
        adminBus
      ]
    });
  },
});
