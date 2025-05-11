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

    // --- Define Secrets ---
    const paperPointsLimitOrder = new sst.Secret("PaperPointsLimitOrder"); 
    const paperPointsUsdcVolume = new sst.Secret("PaperPointsUsdcVolume"); 
    const paperPointsUsdcPnl = new sst.Secret("PaperPointsUsdcPnl"); 

    const coreWalletPk = new sst.Secret("CoreWalletPk");
    const coreVaultAddress = new sst.Secret("CoreVaultAddress");

    const cmcApiKey = new sst.Secret("CmcApiKey");

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

    // Unchanged Traders Table (holds user identity, not mode-specific state)
    const tradersTable = new sst.aws.Dynamo("TradersTable", {
      fields: {
        traderId: "string",
        traderAk: "string",
      },
      primaryIndex: { hashKey: "traderId" },
      globalIndexes: {
        ByAk: { hashKey: "traderAk" },
      },
    });

    const auth = new sst.aws.Auth("CxmputeAuth", {
      issuer: {
        handler: "auth/index.handler",
        link: [
          providerTable,
          tradersTable,
          userTable,
          authEmail,        // <-- makes Resource.AuthEmail.* available
        ],
      },
    });

    // ──────────────────────────────────────────────────────────────
    /* ─── DEX DynamoDB tables (UPDATED FOR PAPER TRADING) ─────── */

    const ordersTable = new sst.aws.Dynamo("OrdersTable", {
      fields: {
        pk:        "string",          // NEW: MARKET#<symbol>#<mode> (e.g., MARKET#BTC-PERP#PAPER)
        sk:        "string",          // Keep: TS#<uuid>
        traderId:  "string",          // Attribute
        orderId:   "string",          // Attribute & GSI Key
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      globalIndexes: {
        // NEW: GSI to query orders by trader and optionally filter by market/mode via SK (pk)
        ByTraderMode: { hashKey: "traderId", rangeKey: "pk" },
        // Keep: GSI to fetch/cancel specific orders
        ByOrderId:  { hashKey: "orderId" }
      },
      stream: "new-and-old-images", // Keep stream for order processing
    });

    

    const balancesTable = new sst.aws.Dynamo("BalancesTable", {
      fields: {
        pk: "string",          // NEW: TRADER#<traderId>#<mode> (e.g., TRADER#uuid123#PAPER)
        sk: "string",          // NEW: ASSET#<asset> (e.g., ASSET#USDC)
        // Attributes: balance, pending remain as attributes
        balance: "number",
        pending: "number",
      },
      // NEW Primary Index using mode-partitioned keys
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
    });

    const tradesTable = new sst.aws.Dynamo("TradesTable", {
      fields: {
        pk:       "string",          // NEW: MARKET#<symbol>#<mode>
        sk:       "string",          // Keep: TS#<tradeId>
        traderId: "string",          // Attribute (used for GSI)
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      globalIndexes: {
        // NEW: GSI to query trades by trader and optionally filter by market/mode via SK (pk)
        ByTraderMode: { hashKey: "traderId", rangeKey: "pk" }
      },
      stream: "new-and-old-images", // Keep stream for S3 archiving
    });

    const positionsTable = new sst.aws.Dynamo("PositionsTable", {
      fields: {
        pk: "string",       // NEW: TRADER#<traderId>#<mode>
        sk: "string",       // Keep: MARKET#<symbol>
        // Attributes: size, avgEntryPrice, pnl etc. remain attributes
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
    });

    const marketsTable = new sst.aws.Dynamo("MarketsTable", {
      fields: {
        pk:     "string",   // NEW: MARKET#<symbol>#<mode>
        sk:     "string",   // Keep: META
        status: "string",   // Attribute & GSI Key
        // Attributes: type, tickSize, synth etc. remain attributes
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      globalIndexes: {
        // NEW: GSI to query markets by status and filter by mode via SK (pk)
        ByStatusMode: { hashKey: "status", rangeKey: "pk" },
      },
    });

    // Unchanged Prices Table (paper uses real prices)
    const pricesTable = new sst.aws.Dynamo("PricesTable", {
      fields: {
        pk: "string",   // ASSET#BTC
        sk: "string",   // TS#ISO
        // Attributes: price, expireAt
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      ttl: "expireAt",
    });

    const statsIntradayTable = new sst.aws.Dynamo("StatsIntradayTable", {
      fields: {
        pk:      "string", // NEW: MARKET#<symbol>#<mode>
        sk:      "string", // Keep: TS#<minute_epoch_ms>
        expireAt:"number", // Keep TTL
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      ttl: "expireAt",
    });

    const statsDailyTable = new sst.aws.Dynamo("StatsDailyTable", {
      fields: {
        pk: "string", // NEW: MARKET#<symbol>#<mode>
        sk: "string", // Keep: YYYY-MM-DD
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
    });

    const statsLifetimeTable = new sst.aws.Dynamo("StatsLifetimeTable", {
      fields: {
        pk: "string", // NEW: KEY#GLOBAL#<mode>
        sk: "string", // Keep: META
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
    });

    const wsConnectionsTable = new sst.aws.Dynamo("WSConnectionsTable", {
      fields: {
        pk:       "string",            // Keep: WS#<connId>
        sk:       "string",            // Keep: META
        expireAt: "number",            // Keep TTL
        channelMode: "string",         // NEW: "REAL" or "PAPER" (nullable if not subscribed)
        // Attributes: traderId, channel etc. remain attributes
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      ttl: "expireAt",
    });

    /* ─── S3 lake for cold trade/metrics history ──────────────────────── */
    const dataLakeBucket = new sst.aws.Bucket("DexDataLakeBucket", { // Unchanged
      versioning: true,
      cors: { allowMethods: ["GET", "PUT"] },
    });

    /* ─── SNS topic for real‑time fan‑out ─────────────────────────────── */
    const marketUpdatesTopic = new sst.aws.SnsTopic("MarketUpdatesTopic"); // Unchanged

    /* ─── SQS FIFO order queues (Reused for both modes) ─────────────── */
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

    /* ─── Dynamo Stream → router Fn → SQS (Router needs updated logic) ─ */
    ordersTable.subscribe("OrdersStreamRouter",{
      handler: "dex/streams/ordersStreamRouter.handler", // Needs update to parse mode from pk
      link: [
        marketOrdersQueue,
        optionsOrdersQueue,
        perpsOrdersQueue,
        futuresOrdersQueue,
      ],
    });

    /* ─── Matcher subscribers (Matchers need updated logic for mode) ─── */
    // Links remain the same, but handlers need mode awareness
    marketOrdersQueue.subscribe({
      handler: "dex/matchers/market.handler",
      link: [
        ordersTable,
        tradesTable,
        positionsTable,
        balancesTable, // ADDED: Needed for direct paper balance updates
        statsIntradayTable,
        statsLifetimeTable,
        marketsTable,
        // wsConnectionsTable, // Not directly needed by matcher? Fanout handles WS
        marketUpdatesTopic,
      ],
      timeout: "60 seconds",
    }, { batch: { size: 10, window: "5 seconds" } });

    optionsOrdersQueue.subscribe({
      handler: "dex/matchers/options.handler",
      link: [
        ordersTable,
        tradesTable,
        positionsTable,
        balancesTable, // ADDED
        statsIntradayTable,
        statsLifetimeTable,
        marketsTable,
        marketUpdatesTopic,
      ],
      timeout: "60 seconds",
    }, { batch: { size: 10, window: "5 seconds" } });

    perpsOrdersQueue.subscribe({
      handler: "dex/matchers/perps.handler",
      link: [
        ordersTable,
        tradesTable,
        positionsTable,
        balancesTable, // ADDED
        statsIntradayTable,
        statsLifetimeTable,
        marketsTable,
        marketUpdatesTopic,
      ],
      timeout: "60 seconds",
    }, { batch: { size: 10, window: "5 seconds" } });

    futuresOrdersQueue.subscribe({
      handler: "dex/matchers/futures.handler",
      link: [
        ordersTable,
        tradesTable,
        positionsTable,
        balancesTable, // ADDED
        statsIntradayTable,
        statsLifetimeTable,
        marketsTable,
        marketUpdatesTopic,
      ],
      timeout: "60 seconds",
    }, { batch: { size: 10, window: "5 seconds" } });

    /* ───  WebSocket API  ─────────────────────────────────────────────── */
    const wsApi = new sst.aws.ApiGatewayWebSocket("DexWsApi", {
      domain: $interpolate`dex.${$app.stage}.cxmpute.cloud`,
    });

    wsApi.route("$connect",    {
      handler: "dex/ws/connect.handler",
      link: [wsConnectionsTable, tradersTable], // Connect needs tradersTable to verify Ak
    });
    wsApi.route("$disconnect", {
      handler: "dex/ws/disconnect.handler",
      link: [wsConnectionsTable],
    });
    wsApi.route("$default",    "dex/ws/default.handler");
    // Subscribe needs logic update for mode-aware channels
    wsApi.route("subscribe",   {
        handler: "dex/ws/subscribe.handler",
        link: [wsConnectionsTable] // Needs to write channelMode
    });

    /* Fan‑out needs logic update for mode-aware channels */
    marketUpdatesTopic.subscribe("WsFanOut", {
      handler: "dex/ws/fanOut.handler",
      link: [
        wsApi,
        wsConnectionsTable, // Needs to read channel/channelMode for filtering
      ],
    });

    /* ─── Scheduled jobs (Cron Jobs need mode awareness) ───────────── */

    /* 1) Oracle pull – Unchanged, uses real prices */
    new sst.aws.Cron("OracleFetchCron", {
      schedule: "rate(1 minute)",
      function: {
        handler: "dex/cron/oracle.handler",
        timeout: "60 seconds",
        memory: "256 MB",
        link: [pricesTable, marketsTable], // Reads market definitions (now includes mode)
      },
    });

    /* 2) Funding tick – Needs mode logic */
    new sst.aws.Cron("FundingCron", {
      schedule: "rate(1 hour)",
      function: {
        handler: "dex/cron/funding.handler", // Needs update
        timeout: "120 seconds",
        memory: "512 MB",
        link: [
          marketsTable,
          positionsTable,
          balancesTable, // ADDED: For paper balance adjustments
          tradesTable, // For mark price source
          statsIntradayTable,
          statsLifetimeTable,
          pricesTable, // For index price source
          // wsApi, // Not directly needed, pushes to SNS
          marketUpdatesTopic,
          coreVaultAddress,
          coreWalletPk,
        ],
        // Environment vars for Vault/CORE_PK needed only if mode is REAL
        environment: {
          PEAQ_RPC_URL: "https://peaq.api.onfinality.io/public",
          CHAIN_ID:     "3338",
        },
      },
    });

    /* 3) Option expiry – Needs mode logic */
    new sst.aws.Cron("OptionExpiryCron", {
      schedule: "rate(1 hour)",
      function: {
        handler: "dex/cron/optionExpiry.handler", // Needs update
        timeout: "120 seconds",
        link: [
          ordersTable,
          positionsTable,
          balancesTable, // ADDED
          tradesTable,
          marketsTable,
          pricesTable, // ADDED: For settlement price source
          // wsApi,
          marketUpdatesTopic,
          coreVaultAddress,
          coreWalletPk,
        ],
        // Environment vars for Vault/CORE_PK needed only if mode is REAL
         environment: {
          PEAQ_RPC_URL: "https://peaq.api.onfinality.io/public",
          CHAIN_ID:     "3338",
        },
      },
    });

    /* 4) Future expiry – Needs mode logic */
    new sst.aws.Cron("FutureExpiryCron", {
      schedule: "rate(1 hour)",
      function: {
        handler: "dex/cron/futureExpiry.handler", // Needs update
        timeout: "120 seconds",
        link: [
          ordersTable,
          positionsTable,
          balancesTable, // ADDED
          tradesTable,
          marketsTable,
          pricesTable, // ADDED: For settlement price source
          // wsApi,
          marketUpdatesTopic,
          coreVaultAddress,
          coreWalletPk,
        ],
         // Environment vars for Vault/CORE_PK needed only if mode is REAL
         environment: {
          PEAQ_RPC_URL: "https://peaq.api.onfinality.io/public",
          CHAIN_ID:     "3338",
        },
      },
    });

    /* 5) Daily metrics roll‑up – Needs mode logic */
    new sst.aws.Cron("MetricsRollupCron", {
      schedule: "cron(0 0 * * ? *)",
      function: {
        handler: "dex/cron/metricsRollup.handler", // Needs update
        timeout: "300 seconds",
        memory: "1024 MB",
        link: [
          statsIntradayTable,
          statsDailyTable,
          dataLakeBucket,
          marketsTable, // To know which markets existed
        ],
      },
    });

    /* PerpDailySettleCron - Needs mode logic */
    new sst.aws.Cron("PerpDailySettleCron", {
      schedule: "cron(5 0 * * ? *)",
      function: {
        handler: "dex/cron/perpsDailySettle.handler", // Needs update
        timeout: "300 seconds",
        link: [
          positionsTable,
          balancesTable, // Needed for both REAL and PAPER balance updates
          pricesTable, // Needed for PnL calculation
          coreVaultAddress,
          coreWalletPk
          // statsIntradayTable, // Not directly needed for settlement?
        ],
        // Environment vars for Vault/CORE_PK only needed for REAL mode (if settlement involves on-chain transfers, which it doesn't seem to here, only balance updates)
        // Keep them linked for consistency if other CRONs need them
        environment: {
          PEAQ_RPC_URL: "https://peaq.api.onfinality.io/public",
          CHAIN_ID:     "3338",
        },
      },
    });

    // Link tables to the NextJS app
    new sst.aws.Nextjs("CxmputeSite", {
      domain: {
        name: "cxmpute.cloud",
        redirects: ["www." + "cxmpute.cloud"],
        aliases: ["trade.cxmpute.cloud"],
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
        wsApi,
        marketUpdatesTopic,
        tradersTable,
        marketOrdersQueue,
        optionsOrdersQueue,
        perpsOrdersQueue,
        futuresOrdersQueue,
        balancesTable,
        paperPointsLimitOrder,
        paperPointsUsdcPnl,
        paperPointsUsdcVolume,
        cmcApiKey,
      ]
    });
  },
});
