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
    // Provider Registration Secret for CLI access control
    const providerRegistrationSecret = new sst.Secret("ProviderRegistrationSecret");

    // --- General Platform Tables & Resources ---
    // Provider Table
    const providerTable = new sst.aws.Dynamo("ProviderTable", {
      fields: {
        providerId: "string",
        providerEmail: "string",
        apiKey: "string",
        referredBy: "string",
        referralCode: "string",
      },
      primaryIndex: { hashKey: "providerId" },
      globalIndexes: {
        ByApiKey: { hashKey: "apiKey" },
        ByEmail: { hashKey: "providerEmail" },
        ByReferredBy: { hashKey: "referredBy" },
        ByReferralCode: { hashKey: "referralCode" }
      }
    });

    // Provisions Table
    const provisionsTable = new sst.aws.Dynamo("ProvisionsTable", {
      fields: {
        provisionId: "string",
        providerId: "string",
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
        randomValue: "number",
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
        randomValue: "number",
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
        randomValue: "number",
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
        randomValue: "number",
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
        referredBy: "string",
        referralCode: "string",
      },
      primaryIndex: { hashKey: "userId" },
      globalIndexes: {
        ByWalletAddress: { hashKey: "userAk" }, // Consider renaming GSI if userAk is not a wallet address
        ByReferredBy: { hashKey: "referredBy" },
        ByReferralCode: { hashKey: "referralCode" }
      }
    });

    // Metadata Table (for AI/Compute services)
    const metadataTable = new sst.aws.Dynamo("MetadataTable", {
      fields: {
        endpoint: "string",
        dayTimestamp: "string",
      },
      primaryIndex: { hashKey: "endpoint", rangeKey: "dayTimestamp" }
    });

    // Service Metadata Table (for AI/Compute services)
    const serviceMetadataTable = new sst.aws.Dynamo("ServiceMetadataTable", {
      fields: {
        serviceName: "string",
      },
      primaryIndex: { hashKey: "serviceName" }
    });

    // Network Stats Table (for AI/Compute services)
    const networkStatsTable = new sst.aws.Dynamo("NetworkStatsTable", {
      fields: {
        dateTimestamp: "string",
        endpointOrModel: "string",
      },
      primaryIndex: { hashKey: "dateTimestamp", rangeKey: "endpointOrModel" },
      globalIndexes: {
        ByEndpointOrModel: { hashKey: "endpointOrModel", rangeKey: "dateTimestamp" }
      }
    });

    // Notifications Table (for admin-sent notifications)
    const notificationsTable = new sst.aws.Dynamo("NotificationsTable", {
      fields: {
        notificationId: "string",
        location: "string", // homepage, user-dashboard, provider-dashboard
        startDate: "string", // ISO date string
        expiryDate: "string", // ISO date string
        active: "string", // "true" or "false" for filtering
      },
      primaryIndex: { hashKey: "notificationId" },
      globalIndexes: {
        ByLocationAndActive: { hashKey: "location", rangeKey: "active" },
        ByActiveAndExpiry: { hashKey: "active", rangeKey: "expiryDate" }
      }
    });

    // Admin Actions Table (for logging admin actions)
    const adminActionsTable = new sst.aws.Dynamo("AdminActionsTable", {
      fields: {
        actionId: "string",
        adminEmail: "string",
        timestamp: "string", // ISO timestamp
        actionType: "string", // suspend, delete, disconnect, etc.
        targetType: "string", // user, provider, provision
        targetId: "string", // ID of the target
      },
      primaryIndex: { hashKey: "actionId" },
      globalIndexes: {
        ByAdminEmail: { hashKey: "adminEmail", rangeKey: "timestamp" },
        ByActionType: { hashKey: "actionType", rangeKey: "timestamp" },
        ByTargetType: { hashKey: "targetType", rangeKey: "timestamp" }
      }
    });

    // Pricing Table (for fee management)
    const pricingTable = new sst.aws.Dynamo("PricingTable", {
      fields: {
        endpoint: "string", // /chat/completions, /embeddings, etc.
        model: "string", // specific model or "default"
        priceType: "string", // per-token, per-request, per-minute, etc.
        lastUpdated: "string", // ISO timestamp
      },
      primaryIndex: { hashKey: "endpoint", rangeKey: "model" },
      globalIndexes: {
        ByPriceType: { hashKey: "priceType", rangeKey: "lastUpdated" }
      }
    });

    // Advertisement Table (assuming general platform feature)
    const advertisementTable = new sst.aws.Dynamo("AdvertisementTable", {
      fields: {
        timeSlotTimestamp: "string",
        location: "string",
      },
      primaryIndex: { hashKey: "timeSlotTimestamp", rangeKey: "location" }
    });

    const graphs = new sst.aws.Bucket("GraphsBucket"); // Assuming general platform bucket

    // --- Authentication ---
    const auth = new sst.aws.Auth("CxmputeAuth", {
      issuer: {
        handler: "auth/index.handler",
        link: [
          providerTable,
          userTable, // Removed TradersTable, BalancesTable
          authEmail,
          providerRegistrationSecret,
        ],
      },
    });

    // ──────────────────────────────────────────────────────────────
    /* ─── DEX DynamoDB tables (REMOVED) ─────── */
    // ordersTable, tradesTable, positionsTable, marketsTable, pricesTable, statsIntradayTable,
    // statsDailyTable, statsLifetimeTable, wsConnectionsTable, klinesTable, tradersTable, balancesTable (DEX)
    // All these are removed.

    /* ─── S3 lake for cold trade/metrics history (REMOVED) ─────────────── */
    // dataLakeBucket (DexDataLakeBucket) removed.

    /* ─── SNS topic for real‑time fan‑out (REMOVED) ─────────────────────── */
    // marketUpdatesTopic removed.

    /* ─── SQS FIFO order queues (REMOVED) ─────────────── */
    // marketOrdersQueue, optionsOrdersQueue, perpsOrdersQueue, futuresOrdersQueue,
    // cancelledOrdersQueue, klineAggregationQueue removed.

    /* ─── Dynamo Stream → router Fn → SQS (REMOVED) ─ */
    // ordersTable.subscribe(...) and tradesTable.subscribe(...) and their targets removed.

    /* ─── Matcher subscribers (REMOVED) ─── */
    // All SQS queue subscribers for matchers removed.

    /* ───  WebSocket API (REMOVED) ─────────────────────────────────── */
    // wsApi (DexWsApi) and its routes removed.

    /* Fan‑out Lambda (REMOVED) */
    // marketUpdatesTopic.subscribe("WsFanOut", ...) removed.

    /* ─── Scheduled jobs (Cron Jobs - All DEX Related Crons REMOVED) ───── */
    // OracleFetchCron, FundingCron, OptionExpiryCron, FutureExpiryCron, MetricsRollupCron,
    // MarketSummaryCron, PerpDailySettleCron, DailyToWeeklyKlineCron, DailyToMonthlyKlineCron all removed.
    // If any CRON job was for non-DEX purposes, it would be kept. Assuming all listed were DEX.

    // --- Next.js Site ---
    // Link tables to the NextJS app
    new sst.aws.Nextjs("CxmputeSite", {
      domain: {
        name: "cxmpute.cloud",
        redirects: ["www." + "cxmpute.cloud"],
        aliases: ["trade.cxmpute.cloud"], // Consider if trade.cxmpute.cloud alias is still needed or should redirect to main site.
      },
      link: [
        // General Platform Resources
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
        notificationsTable,
        adminActionsTable,
        pricingTable,
        advertisementTable,
        auth,
        graphs,
        authEmail,
        // Secrets
        providerRegistrationSecret,
        // All DEX-related resources (tables, queues, topics, secrets) have been removed from this list.
      ]
    });
  },
});