import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// 1. Khai báo Interface mở rộng Request để TypeScript hiểu thuộc tính 'user'
export interface AuthRequest extends Request {
  user?: any; // Bạn có thể thay 'any' bằng Interface User của bạn (ví dụ: { id: string, role: string })
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Lấy token từ Header (Bearer) hoặc từ Query String (cho SSE)
    const authHeader = req.headers.authorization;
    const token = (authHeader && authHeader.split(' ')[1]) || (req.query.token as string);

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Không tìm thấy mã xác thực' 
      });
    }

    // 2. Kiểm tra JWT_SECRET và xử lý lỗi nếu thiếu biến môi trường
    const secret = process.env.JWT_ACCESS_SECRET; // Đổi từ JWT_SECRET thành JWT_ACCESS_SECRET
    if (!secret) {
      console.error('LỖI: JWT_ACCESS_SECRET chưa được định nghĩa trong file .env');
      return res.status(500).json({ 
        success: false, 
        message: 'Lỗi cấu hình hệ thống' 
      });
    }

    // Xác thực Token
    const decoded = jwt.verify(token, secret);
    
    // 3. Gán dữ liệu đã giải mã vào req.user (TypeScript đã hiểu nhờ AuthRequest)
    req.user = decoded;
    
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      message: 'Mã xác thực không hợp lệ hoặc đã hết hạn' 
    });
  }
};