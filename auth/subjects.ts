import { object, string, array, boolean, optional } from "valibot";
import { createSubjects } from "@openauthjs/openauth/subject";

/** OpenAuth subject schema. Everything returned in `ctx.subject()` MUST
 *  validate against this exactly. */
export const subjects = createSubjects({
  user: object({
    id:          string(),        // User ID (from UserTable)
    providerId:  string(),        // Links back to ProviderTable
    providerAk:  string(),        // Provider's API key (from ProviderTable)
    userAks:     array(string()), // Future per-app AKs for the user (can be empty)
    userAk:      string(),        // User's general API key (from UserTable, used for general platform APIs)
    admin:       boolean(),       // Is this user an admin?
    email:       string(),
    walletAddress: optional(string()), // Kept as potentially general platform feature
  }),
});