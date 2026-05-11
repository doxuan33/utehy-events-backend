import { z } from 'zod';

// ── Generate Content ─────────────────────────────────────────────
export const generateContentSchema = z.object({
  prompt: z.string().min(3, 'Vui lòng cung cấp từ khóa hoặc chủ đề cho sự kiện'),
});

// ── Analyze Event ────────────────────────────────────────────────
export const analyzeEventSchema = z.object({
  title: z.string().min(3, 'Tiêu đề sự kiện phải có ít nhất 3 ký tự'),
  description: z.string().optional(),
  location: z.string().optional(),
  organizer: z.string().optional(),
});

// ── Generate Event Poster ────────────────────────────────────────
export const generatePosterSchema = z.object({
  description: z.string().min(3, 'Vui lòng cung cấp mô tả chủ đề sự kiện'),
});

export type GenerateContentInput = z.infer<typeof generateContentSchema>;
export type AnalyzeEventInput = z.infer<typeof analyzeEventSchema>;
export type GeneratePosterInput = z.infer<typeof generatePosterSchema>;
