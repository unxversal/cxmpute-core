// src/lib/auth.ts
import { NextResponse } from "next/server";
import { auth as getAuthenticatedSubject } from "@/app/actions"; // Assuming your actions.ts is in app/
import { ADMIN_EMAILS } from './privateutils';

/**
 * Type definition for the user subject returned by your auth() function.
 * Ensure this matches the structure defined in your auth/subjects.ts
 * and returned by the success callback in auth/index.ts.
 */
export interface AuthenticatedUserSubject {
  type: "user"; // Or whatever your subject type is
  properties: {
    id: string;
    providerId: string;
    providerAk: string;
    userAks: string[];
    userAk: string;
    admin: boolean;
    // Add email if it's part of the subject properties and you need it directly
    email: string; // Or get it via another way if not directly in subject
    traderId: string;
    traderAk: string;
    walletAddress?: string;
  };
}


/**
 * Middleware-like function to ensure the current user is an admin.
 * It calls the existing `getAuthenticatedSubject` function from `app/actions.ts`.
 * If the user is not authenticated or not an admin, it throws a NextResponse
 * which will halt the execution of the API route and return an error.
 *
 * @param req - The NextRequest object, passed through from the API route.
 * @returns The authenticated user's subject if they are an admin.
 * @throws NextResponse with 401 or 403 status if not authenticated or not an admin.
 */
export async function requireAdmin(): Promise<AuthenticatedUserSubject> {
  const subject = await getAuthenticatedSubject();

  if (!subject || subject.type !== "user") {
    console.warn("requireAdmin: No authenticated user subject found or not of type 'user'.");
    // It's important that this NextResponse is thrown, not just returned,
    // so the calling API route stops execution.
    throw NextResponse.json({ error: "Unauthorized: Authentication required." }, { status: 401 });
  }

  // The `admin` boolean is directly available on subject.properties
  if (!subject.properties.admin) {
    console.warn(`requireAdmin: User ${subject.properties.id} is not an admin.`);
    throw NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
  }

  // If you needed to check against ADMIN_EMAILS directly using an email from the subject:
  // (This assumes 'email' is part of subject.properties - adjust if it's not)
  const userEmail = subject.properties.email;
  if (!userEmail || !ADMIN_EMAILS.includes(userEmail)) {
    console.warn(`requireAdmin: User ${subject.properties.id} (Email: ${userEmail}) is not in ADMIN_EMAILS list.`);
    throw NextResponse.json({ error: "Forbidden: Admin access denied." }, { status: 403 });
  }


  // console.log(`requireAdmin: Admin access granted for user ${subject.properties.id}`);
  return subject as AuthenticatedUserSubject; // Cast to specific type for stricter usage
}

// You might also want to have a simple requireAuth if some routes need just authentication
export async function requireAuth(): Promise<AuthenticatedUserSubject> {
    const subject = await getAuthenticatedSubject();
    if (!subject || subject.type !== "user") {
        console.warn("requireAuth: No authenticated user subject found or not of type 'user'.");
        throw NextResponse.json({ error: "Unauthorized: Authentication required." }, { status: 401 });
    }
    return subject as AuthenticatedUserSubject;
}