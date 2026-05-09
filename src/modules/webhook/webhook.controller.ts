import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../../shared/utils/response';

export const webhookController = {
  // POST /api/v1/webhook/google-form
  async googleForm(req: Request, res: Response, next: NextFunction) {
    try {
      // Secret validation - được gửi qua header
      const secret = req.header('x-webhook-secret');
      const expectedSecret = process.env.GOOGLE_FORM_WEBHOOK_SECRET;

      if (!expectedSecret) {
        return sendError(res, 'Webhook secret chưa được cấu hình trên server', 500);
      }

      if (secret !== expectedSecret) {
        return sendError(res, 'Invalid webhook secret', 401);
      }

      // Validate body exists
      if (!req.body) {
        return sendError(res, 'Request body không hợp lệ', 400);
      }

      // TODO: Xử lý dữ liệu form từ Google Forms
      // Dữ liệu thường có dạng: { "Tên": "value", "Email": "value", ... }
      // Có thể tạo event, registration, hoặc gửi notification tùy logic

      // Webhook processed successfully (no logging in production)

      // Example: Extract fields (cần customize theo form cụ thể)
      const formData = req.body as Record<string, any>;
      
      // Response thành công
      return sendSuccess(res, { received: true }, 'Webhook processed successfully');
    } catch (err) {
      next(err);
    }
  },
};
