import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { storage } from '../config/cloudinary';
import { sendError } from '../shared/utils/response';

// Multer storage engine (Cloudinary)
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(file.mimetype)) {
      return cb(null, false); // Reject file
    }
    cb(null, true);
  },
});

// Single file upload middleware
export const uploadSingle = (fieldName: string = 'image') => {
  return (req: Request, res: Response, next: NextFunction) => {
    upload.single(fieldName)(req, res, (err: any) => {
      if (err) {
        // Multer error (file size, file type, etc.)
        if (err.code === 'LIMIT_FILE_SIZE') {
          return sendError(res, 'File quá lớn. Tối đa 5MB', 400);
        }
        if (err.message.includes('Định dạng file không hợp lệ') || err.message.includes('Chỉ chấp nhận')) {
          return sendError(res, err.message, 400);
        }
        return sendError(res, 'Lỗi khi tải ảnh lên: ' + err.message, 500);
      }
      if (!req.file) {
        return sendError(res, 'Không có file nào được tải lên', 400);
      }
      next();
    });
  };
};

// Multiple files upload middleware
export const uploadMultiple = (fieldName: string = 'images', maxCount: number = 5) => {
  return (req: Request, res: Response, next: NextFunction) => {
    upload.array(fieldName, maxCount)(req, res, (err: any) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return sendError(res, 'Một trong các file quá lớn. Tối đa 5MB mỗi file', 400);
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return sendError(res, `Quá nhiều file. Tối đa ${maxCount} ảnh`, 400);
        }
        if (err.message.includes('Định dạng file không hợp lệ') || err.message.includes('Chỉ chấp nhận')) {
          return sendError(res, err.message, 400);
        }
        return sendError(res, 'Lỗi khi tải ảnh lên: ' + err.message, 500);
      }
      if (!req.files || req.files.length === 0) {
        return sendError(res, 'Không có file nào được tải lên', 400);
      }
      next();
    });
  };
};

// Helper to extract URLs from uploaded files
export const getUploadedUrls = (req: Request): string[] => {
  if (req.file) {
    return [req.file.path];
  }
  if (req.files && Array.isArray(req.files)) {
    return req.files.map((file: any) => file.path);
  }
  return [];
};

// Helper for single file URL
export const getUploadedUrl = (req: Request): string | null => {
  return req.file ? req.file.path : null;
};
