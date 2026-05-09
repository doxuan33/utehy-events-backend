import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './authenticate';

// Middleware kiểm tra role (RBAC) - chặn sinh viên truy cập API admin
export const hasRole = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;
    if (!userRole) {
      return res.status(401).json({ success: false, message: 'Chưa xác thực' });
    }
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Bạn không có quyền thực hiện thao tác này. Vui lòng sử dụng tài khoản System Admin hoặc Page Admin'
      });
    }
    next();
  };
};

// Middleware cũ giữ lại để đảm bảo backward compatibility
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền thực hiện thao tác này' });
    }
    next();
  };
};