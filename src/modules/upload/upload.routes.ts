import { Router } from 'express';
import multer from 'multer';
import { storage } from '../../config/cloudinary';
import { sendSuccess, sendError } from '../../shared/utils/response';
import { authenticate } from '../../middlewares/authenticate';

const router = Router();
const upload = multer({ storage });

// POST /api/v1/upload
// Note: Frontend uses field name 'image'
router.post('/', authenticate, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, 'Không có file nào được tải lên', 400);
    }

    // req.file.path is the URL returned from Cloudinary
    return sendSuccess(res, {
      url: req.file.path,
      filename: req.file.filename,
    }, 'Tải ảnh lên thành công');
  } catch (error: any) {
    return sendError(res, error.message || 'Lỗi khi tải ảnh lên', 500);
  }
});

export default router;
