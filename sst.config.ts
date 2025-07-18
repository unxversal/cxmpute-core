// sst.config.ts
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "cxmpute-cloud",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
    };
  },
  async run() {

    // --- Define Secrets ---
    // Provider Registration Secret for CLI access control
    const providerRegistrationSecret = new sst.Secret("ProviderRegistrationSecret");
    const peaqRpcUrl = new sst.Secret("PeaqRpcUrl");
    const peaqAdminPrivateKey = new sst.Secret("PeaqAdminPrivateKey");
    const multisigAddress = new sst.Secret("MultisigAddress");
    const rolloverUrl = new sst.Secret("RolloverUrl");
    const cxptAddress = new sst.Secret("CxptAddress");
    const vaultAddress = new sst.Secret("CxptVaultAddress");
    const rewardDistributorAddress = new sst.Secret("RewardDistributorAddress");
    const communityVesterAddress = new sst.Secret("CommunityVesterAddress");
    const subscriptionManagerAddress = new sst.Secret("SubscriptionManagerAddress");
    const MerkleUpdaterKey = new sst.Secret("MerkleUpdaterKey");

    // --- General Platform Tables & Resources ---
    // Provider Table
    const providerTable = new sst.aws.Dynamo("ProviderTable", {
      fields: {
        providerId: "string",
        providerEmail: "string",
        apiKey: "string",
        referredBy: "string",
        referralCode: "string",
        walletAddress: "string",
      },
      primaryIndex: { hashKey: "providerId" },
      globalIndexes: {
        ByApiKey: { hashKey: "apiKey" },
        ByEmail: { hashKey: "providerEmail" },
        ByReferredBy: { hashKey: "referredBy" },
        ByReferralCode: { hashKey: "referralCode" },
        ByWalletAddress: { hashKey: "walletAddress" }
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
      sender: $app.stage === "production" ? "cxmpute.cloud" : "dev.cxmpute.cloud",
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
        serviceType: "string", // Always "scraping" for grouping
        randomValue: "number",
      },
      primaryIndex: { hashKey: "provisionId" },
      globalIndexes: {
        ByServiceRandom: { hashKey: "serviceType", rangeKey: "randomValue" }
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
        referredBy: "string",
        referralCode: "string",
        walletAddress: "string",
      },
      primaryIndex: { hashKey: "userId" },
      globalIndexes: {
        ByWalletAddress: { hashKey: "walletAddress" },
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

    // Advertisement Table (assuming general platform feature)
    const advertisementTable = new sst.aws.Dynamo("AdvertisementTable", {
      fields: {
        timeSlotTimestamp: "string",
        location: "string",
      },
      primaryIndex: { hashKey: "timeSlotTimestamp", rangeKey: "location" }
    });

    // Notifications Table (for admin notifications)
    const notificationsTable = new sst.aws.Dynamo("NotificationsTable", {
      fields: {
        notificationId: "string",
        motif: "string",
        startDate: "string",
      },
      primaryIndex: { hashKey: "notificationId" },
      globalIndexes: {
        ByMotif: { hashKey: "motif", rangeKey: "startDate" },
        ByStartDate: { hashKey: "startDate" }
      }
    });

    // Suspended Accounts Table (for admin account management)
    const suspendedAccountsTable = new sst.aws.Dynamo("SuspendedAccountsTable", {
      fields: {
        accountId: "string", // userId or providerId
        accountType: "string", // "user" or "provider"
        suspendedDate: "string",
      },
      primaryIndex: { hashKey: "accountId" },
      globalIndexes: {
        ByType: { hashKey: "accountType", rangeKey: "suspendedDate" }
      }
    });

    // Pricing Config Table (for admin pricing management)
    const pricingConfigTable = new sst.aws.Dynamo("PricingConfigTable", {
      fields: {
        configId: "string", // "current" for active config
        endpoint: "string", // API endpoint this pricing applies to
        lastUpdated: "string",
      },
      primaryIndex: { hashKey: "configId" },
      globalIndexes: {
        ByEndpoint: { hashKey: "endpoint", rangeKey: "lastUpdated" }
      }
    });

    // ------------------------------------------------------------------
    // New tables for on-chain & billing sprint
    // ------------------------------------------------------------------

    // ProviderPointsTable – stores cumulative points earned per provider per epoch
    const providerPointsTable = new sst.aws.Dynamo("ProviderPointsTable", {
      fields: {
        providerId: "string", // PK
        epoch: "string", // optional GSI key for latest epoch queries
      },
      primaryIndex: { hashKey: "providerId" },
      globalIndexes: {
        ByEpoch: { hashKey: "epoch", rangeKey: "providerId" }
      }
    });

    // SubscriptionsTable – tracks active subscription plans for users
    const subscriptionsTable = new sst.aws.Dynamo("SubscriptionsTable", {
      fields: {
        userId: "string",
      },
      primaryIndex: { hashKey: "userId" }
    });

    // MultisigProposalsTable – off-chain mirror of on-chain multisig proposals for UI convenience
    const multisigProposalsTable = new sst.aws.Dynamo("MultisigProposalsTable", {
      fields: {
        proposalId: "string",
      },
      primaryIndex: { hashKey: "proposalId" }
    });

    const graphs = new sst.aws.Bucket("GraphsBucket"); // Assuming general platform bucket

    // --- Authentication ---
    const auth = new sst.aws.Auth("CxmputeAuth", {
      issuer: {
        handler: "auth/index.handler",
        link: [
          providerTable,
          userTable,
          authEmail,
          providerRegistrationSecret,
        ],
      },
      ...$app.stage === "production" && {
        domain: 'auth.cxmpute.cloud'
      }
    });

    // --- Next.js Site ---
    // Rewards rollover cron (disabled)
    new sst.aws.Cron("RewardsCron", {
      enabled: false,
      schedule: "rate(1 day)",
      job: {
        handler: "src/jobs/rewardsCron.handler",
        link: [rolloverUrl],
      },
    });

    new sst.aws.Nextjs("CxmputeWebSite", {
      ...$app.stage === "production" && {
        domain: {
          name: "cxmpute.cloud",
          redirects: ["www." + "cxmpute.cloud"],
        },
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
        advertisementTable,
        notificationsTable,
        suspendedAccountsTable,
        pricingConfigTable,
        providerPointsTable,
        subscriptionsTable,
        multisigProposalsTable,
        auth,
        graphs,
        authEmail,
        // Secrets
        providerRegistrationSecret,
        peaqRpcUrl,
        peaqAdminPrivateKey,
        cxptAddress,
        vaultAddress,
        rewardDistributorAddress,
        communityVesterAddress,
        subscriptionManagerAddress,
        MerkleUpdaterKey,
        multisigAddress,
        rolloverUrl,
        // All DEX-related resources (tables, queues, topics, secrets) have been removed from this list.
      ]
    });
  },
});