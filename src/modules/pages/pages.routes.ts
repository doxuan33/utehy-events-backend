import { Router } from 'express';
import { pagesController } from './pages.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();

// ── Tất cả đều cần đăng nhập ─────────────────────────────────
router.get('/',          authenticate, pagesController.getPages);
router.get('/following', authenticate, pagesController.getFollowingPages);
router.get('/:slug',     authenticate, pagesController.getPageBySlug);

// ── Chỉ System Admin tạo page ────────────────────────────────
router.post('/', authenticate, authorize('SYSTEM_ADMIN'), pagesController.createPage);

// ── Page Admin cập nhật trang của mình ───────────────────────
router.patch('/:id', authenticate, authorize('PAGE_ADMIN', 'SYSTEM_ADMIN'), pagesController.updatePage);

// ── Sinh viên follow / unfollow ───────────────────────────────
router.post('/:id/follow',   authenticate, pagesController.followPage);
router.delete('/:id/follow', authenticate, pagesController.unfollowPage);

// ── System Admin quản lý thành viên ──────────────────────────
router.post('/:id/members',              authenticate, authorize('SYSTEM_ADMIN'), pagesController.addMember);
router.delete('/:id/members/:userId',    authenticate, authorize('SYSTEM_ADMIN'), pagesController.removeMember);

// ── Sinh viên nộp đơn gia nhập CLB ───────────────────────────
router.post('/:id/join',   authenticate, pagesController.joinPage);

// ── System Admin / Page Admin quản lý đơn xin gia nhập ───────
router.get(   '/:id/join-requests',           authenticate, authorize('PAGE_ADMIN', 'SYSTEM_ADMIN'), pagesController.getJoinRequests);
router.patch('/:id/join-requests/:userId/approve', authenticate, authorize('PAGE_ADMIN', 'SYSTEM_ADMIN'), pagesController.approveJoinRequest);
router.patch('/:id/join-requests/:userId/reject',  authenticate, authorize('PAGE_ADMIN', 'SYSTEM_ADMIN'), pagesController.rejectJoinRequest);

// ── System Admin / Page Admin quản lý thành viên ─────────────
router.get(   '/:id/members',                   authenticate, authorize('PAGE_ADMIN', 'SYSTEM_ADMIN'), pagesController.getMembers);
router.patch('/:id/members/:userId/role',       authenticate, authorize('PAGE_ADMIN', 'SYSTEM_ADMIN'), pagesController.updateMemberRole);
router.delete('/:id/members/:userId/kick',      authenticate, authorize('PAGE_ADMIN', 'SYSTEM_ADMIN'), pagesController.kickMember);

export default router;