import { Router } from 'express';
import { postsController } from './posts.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();

// ── Newsfeed ──────────────────────────────────────────────────
router.get('/newsfeed', authenticate, postsController.getNewsfeed);

// ── Bài viết ──────────────────────────────────────────────────
router.get('/:id',    authenticate, postsController.getPostById);
router.post('/',      authenticate, authorize('PAGE_ADMIN', 'SYSTEM_ADMIN'), postsController.createPost);
router.patch('/:id',  authenticate, authorize('PAGE_ADMIN', 'SYSTEM_ADMIN'), postsController.updatePost);
router.delete('/:id', authenticate, authorize('PAGE_ADMIN', 'SYSTEM_ADMIN'), postsController.deletePost);

// ── Like ──────────────────────────────────────────────────────
router.post('/:id/like', authenticate, postsController.toggleLike);

// ── Bình luận ─────────────────────────────────────────────────
router.get('/:id/comments',                   authenticate, postsController.getComments);
router.post('/:id/comments',                  authenticate, postsController.createComment);
router.delete('/:postId/comments/:commentId', authenticate, postsController.deleteComment);

export default router;