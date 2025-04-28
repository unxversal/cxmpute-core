// app/dashboard/page.tsx
import { auth, login, logout } from "../actions"; // adjust path if needed

export default async function DashboardPage() {
  // runs on the server — checks the cookies and (maybe) refreshes tokens
  const user = await auth();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6">
      {/* ────────────────────────────────────────────────── */}
      {/*  NOT LOGGED-IN  →  show Login button              */}
      {/*  LOGGED-IN     →  show Logout button             */}
      {/* ────────────────────────────────────────────────── */}
      {user ? (
        <form action={logout}>
          <button
            type="submit"
            className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            Log out
          </button>
        </form>
      ) : (
        <form action={login}>
          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Log in
          </button>
        </form>
      )}
    </main>
  );
}