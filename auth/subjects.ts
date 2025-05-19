import { object, string, array, boolean, optional } from "valibot";
import { createSubjects } from "@openauthjs/openauth/subject";

/** OpenAuth subject schema. Everything returned in `ctx.subject()` MUST
 *  validate against this exactly. */
export const subjects = createSubjects({
  user: object({
    id:          string(),        // User ID (from UserTable, maps to internalDEXTraderId for some DEX ops)
    providerId:  string(),        // Links back to ProviderTable
    providerAk:  string(),        // Provider's API key (from ProviderTable)
    userAks:     array(string()), // Future per-app AKs for the user (can be empty)
    userAk:      string(),        // User's general API key (from UserTable, used for general platform APIs)
    admin:       boolean(),       // Is this user an admin?
    email:       string(),

    // DEX Specific fields added
    traderId:    string(),        // Unique ID for the trader in TradersTable (PK of TradersTable)
    traderAk:    string(),        // Access Key for trading APIs (this will be UserTable.userAk, stored as TradersTable.userAk for GSI)
    walletAddress: optional(string()),
  }),
});