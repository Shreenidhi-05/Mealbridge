// src/lib/validators/donation.ts
import { z } from "zod";

export const createDonationSchema = z.object({
  foodType: z.string().min(2).max(120),
  servingsTotal: z.number().int().positive().max(5000),
  dietaryCategory: z.enum(["VEG", "NON_VEG", "BOTH", "JAIN", "VEGAN"]),
  pickupWindowStart: z.string().datetime(),
  pickupWindowEnd: z.string().datetime(),
  expiryAt: z.string().datetime(),
  locationText: z.string().min(2).max(200).optional(),
  city: z.string().min(2).max(60).optional(),
  zone: z.string().min(2).max(60).optional(),

  // Auto-split controls (v1)
  // If not provided, we auto-create exactly one lot equal to servingsTotal.
  // If provided, we create lots of size <= lotSize.
  lotSize: z.number().int().positive().max(5000).optional(),
});

export type CreateDonationInput = z.infer<typeof createDonationSchema>;
