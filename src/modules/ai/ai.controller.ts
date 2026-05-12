import { Request, Response, NextFunction } from 'express';
import { aiService } from './ai.service';
import { generateContentSchema, analyzeEventSchema, generatePosterSchema } from './ai.schema';
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
        // Graceful fallback: trả về 200 với tin nhắn thân thay vì 500
        return sendSuccess(res, {
          title: 'Dịch vụ tạm thời không khả dụng',
          description: 'Xin lỗi, hệ thống AI hiện đang quá tải hoặc có lỗi. Bạn vui lòng thử lại sau vài phút nhé!',
          tags: ['service-unavailable'],
        }, 'AI fallback');
      }
    },

    // POST /api/v1/ai/analyze-event
    async analyzeEvent(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const parsed = analyzeEventSchema.safeParse(req.body);
        if (!parsed.success) {
          return sendError(res, parsed.error.issues[0].message, 400);
        }

        const result = await aiService.analyzeEventQuality(parsed.data as any);
        return sendSuccess(res, result, 'Phân tích sự kiện thành công');
      } catch (err: any) {
        console.error('Error in analyzeEvent:', err);
        // Graceful fallback: trả về 200 với tin nhắn thân thay vì 500
        return sendSuccess(res, {
          isSafe: true,
          score: 50,
          reason: 'Không thể phân tích do hệ thống AI quá tải hoặc có lỗi. Vui lòng thử lại sau.',
        }, 'AI fallback');
      }
    },

   // POST /api/v1/ai/generate-poster
   async generatePoster(req: AuthRequest, res: Response, next: NextFunction) {
     try {
       const parsed = generatePosterSchema.safeParse(req.body);
       if (!parsed.success) {
         return sendError(res, parsed.error.issues[0].message, 400);
       }

       const result = await aiService.generateEventPoster(parsed.data.description);
       return sendSuccess(res, result, 'Tạo poster sự kiện thành công');
     } catch (err: any) {
       console.error('Error in generatePoster:', err);
       return sendError(res, err.message || 'Không thể tạo poster sự kiện', 500);
     }
   },

    // POST /api/v1/ai/chat  — Chatbot tư vấn sự kiện thực tế
    async chat(req: AuthRequest, res: Response, next: NextFunction) {
      try {
        const { message } = req.body;
        if (!message || typeof message !== 'string') {
          return sendError(res, 'Vui lòng cung cấp câu hỏi (message)', 400);
        }

        const reply = await aiService.generateChatResponse(message);
        return sendSuccess(res, { reply }, 'Chatbot phản hồi thành công');
      } catch (err: any) {
        console.error('Error in chat:', err);
        // Graceful fallback: trả về 200 với tin nhắn thân thay vì 500
        return sendSuccess(res, { reply: 'Xin lỗi, hệ thống AI hiện đang quá tải. Bạn vui lòng thử lại sau vài phút nhé!' }, 'AI fallback');
      }
    },

 };