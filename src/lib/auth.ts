// src/lib/auth.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options"; 
import type { Role } from "@prisma/client";

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("UNAUTHORIZED");
  return session;
}

export function requireRole(session: any, allowed: Role[]) {
  const role = session?.user?.role as Role | undefined;
  if (!role || !allowed.includes(role)) throw new Error("FORBIDDEN");
  return role;
}
