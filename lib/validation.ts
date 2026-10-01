import { z } from "zod";
import { covers } from "./covers";
export const captureSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    email: z.union([z.email(), z.literal("")]).default(""),
    phone: z.string().max(24).default(""),
    consent: z.literal(true),
    website: z.literal("").default(""),
    votes: z
      .array(
        z.object({
          coverId: z.enum(covers.map((c) => c.id) as [string, ...string[]]),
          liked: z.boolean(),
        }),
      )
      .length(covers.length),
  })
  .superRefine((v, ctx) => {
    if (
      !v.email &&
      !/^\+?[1-9][0-9]{7,14}$/.test(v.phone.replace(/[\s()-]/g, ""))
    )
      ctx.addIssue({
        code: "custom",
        message: "Add a valid email or a phone number with country code.",
      });
    if (
      v.phone &&
      !/^\+?[1-9][0-9]{7,14}$/.test(v.phone.replace(/[\s()-]/g, ""))
    )
      ctx.addIssue({
        code: "custom",
        message: "Use a valid phone number including country code.",
      });
    if (new Set(v.votes.map((x) => x.coverId)).size !== covers.length)
      ctx.addIssue({
        code: "custom",
        message: "Please vote on every cover once.",
      });
  });
