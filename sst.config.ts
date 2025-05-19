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
    const coreFactoryAddress = new sst.Secret("CoreFactoryAddress");

    const cxpttokenaddress = new sst.Secret("CxptTokenAddress");

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
      // These are the attributes forming the PRIMARY KEY of the table itself.
      fields: {
        pk: "string", // Primary Key: e.g., MARKET#[FullSymbolOrBasePair]#<mode>
        sk: "string", // Sort Key: e.g., META
        
        // Attributes that will be used as HASH or RANGE keys in GSIs MUST exist in your items.
        // You don't *have* to list every GSI key attribute in `fields` here if they aren't
        // part of the main table's primary key, but it can be good for clarity.
        // SST primarily uses `fields` to define the schema for the main table's keys.
        // For GSIs, the critical part is the `globalIndexes` definition.
        
        // Let's list attributes that will form parts of our GSI keys for clarity,
        // even if not strictly required by SST `fields` if not part of table PK/SK.
        status: "string",               // Used as GSI PK in ByStatusMode
        underlyingPairSymbol: "string", // Will be part of the constructed GSI PK for InstrumentsByUnderlying
        // The actual GSI keys `gsi1pk` and `gsi1sk` will be attributes you create in your items.
        gsi1pk: "string", // Attribute that will hold the HASH KEY value for InstrumentsByUnderlying GSI
        gsi1sk: "string", // Attribute that will hold the RANGE KEY value for InstrumentsByUnderlying GSI
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      globalIndexes: {
        // Existing GSI: For admin to view markets by status and mode
        ByStatusMode: { 
          hashKey: "status",    // Uses the 'status' attribute as its hash key
          rangeKey: "pk"        // Uses the main table's 'pk' attribute as its range key
                                // (projection includes all attributes by default)
        },
        
        // NEW GSI: To find all derivative instruments for a given underlying pair, mode, type, and status.
        // Your application logic will CONSTRUCT and STORE `gsi1pk` and `gsi1sk` attributes in each relevant item.
        InstrumentsByUnderlying: { 
          hashKey: "gsi1pk",  // This GSI uses the attribute named 'gsi1pk' as its hash key.
          rangeKey: "gsi1sk", // This GSI uses the attribute named 'gsi1sk' as its range key.
          // By default, SST projects all attributes. If you need to optimize, specify `projectedAttributes`.
          // Example: projectedAttributes: ["symbol", "type", "expiryTs", "strikePrice", "optionType", "tickSize", "lotSize"]
        }
      },
      // All other attributes of MarketMeta (baseAsset, quoteAsset, allowsOptions, defaultTickSize, etc.)
      // will be stored in the items but don't need to be in `fields` unless they are part of a key.
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
        channel:  "string",            // Attribute for GSI Hash Key
        // channelMode: "string",         // NEW: "REAL" or "PAPER" (nullable if not subscribed)
        // Attributes: traderId, channel etc. remain attributes
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      globalIndexes: {
        // NEW GSI: To efficiently query connections by channel
        ByChannel: { 
          hashKey: "channel",   // The attribute storing the full channel string (e.g., "market.BTC-PERP.REAL")
          rangeKey: "pk"        // Using the table's PK as the GSI's sort key allows fetching all attributes
                                // or just 'pk' (connectionId) if that's all fanOut needs.
                                // Default projection is ALL_ATTRIBUTES. If you only need connectionId for fan-out,
                                // you could project only 'pk' to save on GSI storage/RCU costs.
                                // For simplicity and flexibility, ALL_ATTRIBUTES is fine for now.
        }
        // You might have other GSIs here if needed for other query patterns
      },
      ttl: "expireAt",
    });

    const klinesTable = new sst.aws.Dynamo("KlinesTable", {
      fields: {
        pk: "string", // MARKET#[instrumentSymbol]#<mode>
        sk: "string", // INTERVAL#[interval_str]#TS#<start_timestamp_seconds>
        // No other fields needed for indexing schema, others are just attributes
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      // No GSIs needed if queries are always by market and then time range for a specific interval.
      // If you need to query, e.g., all "1h" klines across all markets, a GSI would be needed.
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

    const cancelledOrdersQueue = new sst.aws.Queue("CancelledOrdersQueue", {
      fifo: true, // Recommended for ordered processing of cancellations for a market/trader
      // contentBasedDeduplication: true, // If using MessageDeduplicationId in router
      visibilityTimeout: "60 seconds", // Adjust based on processor lambda timeout
    });


    const klineAggregationQueue = new sst.aws.Queue("KlineAggregationQueue", {
      // fifo: true, // Consider FIFO if strict order of trades for kline building is critical
      // visibilityTimeout: "60 seconds", // Needs to be longer than klineAggregator Lambda timeout
    });

    tradesTable.subscribe("TradesStreamRouterForAggregators", { // Or add to existing router
      handler: "dex/streams/tradesStreamRouter.handler", // A new router or modify existing
      link: [
          // ... existing links like dataLakeBucket for archiving ...
          klineAggregationQueue, // NEW: Link queue for kline aggregation
      ],
    });

    klineAggregationQueue.subscribe({
      handler: "dex/aggregators/klineAggregator.handler",
      link: [klinesTable], // Needs access to write to KlinesTable
      timeout: "55 seconds", // Adjust as needed
      memory: "512 MB", // Adjust based on batch size & complexity
      // Optional: environment variables for supported intervals, default values etc.
    });
  

    /* ─── Dynamo Stream → router Fn → SQS (Router needs updated logic) ─ */
    ordersTable.subscribe("OrdersStreamRouter",{
      handler: "dex/streams/ordersStreamRouter.handler", // Needs update to parse mode from pk
      link: [
        marketOrdersQueue,
        optionsOrdersQueue,
        perpsOrdersQueue,
        futuresOrdersQueue,
        cancelledOrdersQueue,
      ],
    });

    cancelledOrdersQueue.subscribe({ // Give it a unique name
      handler: "dex/processors/cancellationProcessor.handler", // Path to the new Lambda
      link: [
        balancesTable,
        marketsTable,
      ],
      timeout: "45 seconds", // Should be less than queue visibility timeout
      memory: "256 MB",    // Adjust as needed
      // deadLetterQueue: myDlq, // Strongly recommended for production
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
      domain: $interpolate`${$app.stage}.dex.cxmpute.cloud`,
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

     /* ─── New Market Summary Cron Job ────────────────────────────────── */
     new sst.aws.Cron("MarketSummaryCron", {
      schedule: "rate(1 minute)", // Adjust schedule as needed (e.g., "rate(1 minute)")
      job: {
        handler: "dex/cron/marketSummary.handler",
        timeout: "50 seconds", // Should be less than schedule rate
        memory: "512 MB",      // Adjust based on how many markets you have
        link: [
          marketsTable,
          positionsTable,
          tradesTable,
          pricesTable,
          statsIntradayTable,
          marketUpdatesTopic, // To publish the summary
        ],
        // No specific environment variables needed unless your pkHelper depends on them
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

    /* ─── New CRON Job for Daily-to-Weekly Kline Rollup ─────────────────── */
    new sst.aws.Cron("DailyToWeeklyKlineCron", {
      // Example: Run every Monday at 00:05 UTC 
      // (adjust timing, ensure it runs after all daily klines for Sunday are likely complete)
      schedule: "cron(5 0 ? * MON *)", 
      job: {
        handler: "dex/aggregators/dailyToWeeklyKlineCron.handler",
        timeout: "10 minutes", // Might process many markets, give it ample time
        memory: "512 MB",      // Adjust based on number of markets
        link: [
          klinesTable,    // Read daily klines, Write weekly klines
          marketsTable,   // To get the list of active instrument symbols
        ],
        environment: {
            // Optional: Pass the target interval string if the lambda is generic
            TARGET_INTERVAL: "1w",
            SOURCE_INTERVAL: "1d",
            DAYS_TO_AGGREGATE: "7",
        }
      },
    });

    /* ─── New CRON Job for Daily-to-Monthly Kline Rollup ────────────────── */
    new sst.aws.Cron("DailyToMonthlyKlineCron", {
      // Example: Run on the 1st day of every month at 01:05 UTC
      // (adjust timing, ensure it runs after all daily klines for the previous month are complete)
      schedule: "cron(5 1 1 * ? *)", 
      job: {
        handler: "dex/aggregators/dailyToMonthlyKlineCron.handler",
        timeout: "20 minutes", // Processing a whole month of daily data for all markets can take time
        memory: "1024 MB",     // Potentially more memory needed
        link: [
          klinesTable,    // Read daily klines, Write monthly klines
          marketsTable,   // To get the list of active instrument symbols
        ],
        environment: {
            TARGET_INTERVAL: "1M",
            SOURCE_INTERVAL: "1d",
            // DAYS_TO_AGGREGATE is not fixed for month, logic will handle it
        }
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
        coreFactoryAddress,
        klinesTable,
        cancelledOrdersQueue,
        cxpttokenaddress,
      ]
    });
  },
});
