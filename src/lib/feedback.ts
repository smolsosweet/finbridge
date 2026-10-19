import { z } from "zod";
export const feedbackSchema = z.object({
  mutationId: z.string().uuid(), kind: z.enum(["contact", "feature"]),
  subject: z.string().trim().max(120).default(""),
  message: z.string().trim().min(1).max(2000),
}).strict();
export type FeedbackInput = z.infer<typeof feedbackSchema>;
export type FeedbackReceipt = { id: string; kind: FeedbackInput["kind"]; status: "received"; createdAt: string };
export class FeedbackError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 409) { super(code); this.code = code; this.status = status; }
}
