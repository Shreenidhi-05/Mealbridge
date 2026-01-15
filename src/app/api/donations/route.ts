// src/app/api/donations/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, requireRole } from "@/lib/auth";
import { createDonationSchema } from "@/lib/validators/donation";
import { splitIntoLots } from "@/lib/splitting";
import type { Role } from "@prisma/client";

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    requireRole(session, ["DONOR" as Role]);

    const body = await req.json();
    const parsed = createDonationSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues.map(i => i.message).join(", "));
    }

    const {
      foodType,
      servingsTotal,
      dietaryCategory,
      pickupWindowStart,
      pickupWindowEnd,
      expiryAt,
      locationText,
      city,
      zone,
      lotSize,
    } = parsed.data;

    const start = new Date(pickupWindowStart);
    const end = new Date(pickupWindowEnd);
    const expiry = new Date(expiryAt);

    if (!(start < end)) return badRequest("pickupWindowStart must be before pickupWindowEnd");
    if (!(end <= expiry)) return badRequest("pickupWindowEnd must be on/before expiryAt");
    if (expiry.getTime() - Date.now() <= 0) return badRequest("expiryAt must be in the future");

    // Get donor user id from email
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    });
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    if (user.role !== "DONOR") return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

    const lotSizes = splitIntoLots(servingsTotal, lotSize);

    const created = await prisma.$transaction(async (tx) => {
      const donation = await tx.donation.create({
        data: {
          donorId: user.id,
          foodType,
          servingsTotal,
          dietaryCategory,
          pickupWindowStart: start,
          pickupWindowEnd: end,
          expiryAt: expiry,
          locationText: locationText ?? null,
          city: city ?? null,
          zone: zone ?? null,
          // status defaults to POSTED
        },
      });

      await tx.donationLot.createMany({
        data: lotSizes.map((s) => ({
          donationId: donation.id,
          servings: s,
          // status defaults OPEN
        })),
      });

      const lots = await tx.donationLot.findMany({
        where: { donationId: donation.id },
        select: { id: true, servings: true, status: true },
        orderBy: { createdAt: "asc" },
      });

      return { donation, lots };
    });

    return NextResponse.json(
      {
        ok: true,
        donation: {
          id: created.donation.id,
          status: created.donation.status,
          foodType: created.donation.foodType,
          servingsTotal: created.donation.servingsTotal,
          dietaryCategory: created.donation.dietaryCategory,
          pickupWindowStart: created.donation.pickupWindowStart,
          pickupWindowEnd: created.donation.pickupWindowEnd,
          expiryAt: created.donation.expiryAt,
          city: created.donation.city,
          zone: created.donation.zone,
        },
        lots: created.lots,
      },
      { status: 201 }
    );
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }
    if (msg === "FORBIDDEN") {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function GET() {
  // Simple donor “My Donations” list (v1)
  try {
    const session = await requireSession();
    requireRole(session, ["DONOR" as Role, "ADMIN" as Role]);

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    });
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const where =
      user.role === "ADMIN"
        ? {}
        : { donorId: user.id };

    const donations = await prisma.donation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        foodType: true,
        servingsTotal: true,
        dietaryCategory: true,
        pickupWindowStart: true,
        pickupWindowEnd: true,
        expiryAt: true,
        city: true,
        zone: true,
        createdAt: true,
      },
      take: 30,
    });

    return NextResponse.json({ ok: true, donations });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }
    if (msg === "FORBIDDEN") {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
