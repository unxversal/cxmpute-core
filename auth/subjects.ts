import { object, string, array } from "valibot";
import { createSubjects } from "@openauthjs/openauth/subject";

/** OpenAuth subject schema.  Everything returned in `ctx.subject()` MUST
 *  validate against this exactly. */
export const subjects = createSubjects({
  user: object({
    id:          string(),        // User ID
    providerId:  string(),        // Links back to ProviderTable
    providerAk:  string(),        // Same AK we stored on the provider
    userAks:     array(string()), // Future per-app AKs (can be empty)
    userAk:  string(),        // User's API key (for this app)
  }),
});