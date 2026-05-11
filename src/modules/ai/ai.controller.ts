import { Request, Response, NextFunction } from 'express';
import { aiService } from './ai.service';
import { generateContentSchema, analyzeEventSchema } from './ai.schema';
import { sendSuccess, sendError } from '../../shared/utils/response';
import { AuthRequest } from '../../middlewares/authenticate';

export const aiController = {

  // POST /api/v1/ai/generate-content
  async generateContent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = generateContentSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, parsed.error.issues[0].message, 400);
      }

      const result = await aiService.generateEventContent(parsed.data.prompt);
      return sendSuccess(res, result, 'Tạo nội dung sự kiện thành công');
    } catch (err: any) {
      console.error('Error in generateContent:', err);
      return sendError(res, err.message || 'Internal Server Error', 500);
    }
  },

  // POST /api/v1/ai/analyze-event
  async analyzeEvent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = analyzeEventSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, parsed.error.issues[0].message, 400);
      }

      const result = await aiService.analyzeEventQuality(parsed.data);
      return sendSuccess(res, result, 'Phân tích sự kiện thành công');
    } catch (err: any) {
      console.error('Error in analyzeEvent:', err);
      return sendError(res, err.message || 'Internal Server Error', 500);
    }
  },

};