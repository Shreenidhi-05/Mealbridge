import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

export async function POST(req: Request) {
  const { email, password, role } = await req.json();

  if (!email || !password || !role) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (role !== "DONOR" && role !== "NGO") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ error: "Email already exists" }, { status: 409 });
  }

  const passwordHash = await hash(password, 12);

  const user = await prisma.user.create({
    data: { email, passwordHash, role },
    select: { id: true, email: true, role: true },
  });

  return NextResponse.json(user, { status: 201 });
}
