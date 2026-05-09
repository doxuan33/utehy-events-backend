# Module 1: Quản lý Danh tính & Người dùng - UTEHY Social
## Implementation Complete ✅

### Summary of Changes

All code follows **Clean Architecture** with **Controller/Service** separation, **ES6+** syntax, **try/catch** error handling, **Prisma transactions**, and **real-world data processing**.

---

## 1. ✅ Auth Login (Pre-existing, Verified)
**File**: `Backend/src/modules/auth/auth.service.ts`
- Bcrypt password verification
- JWT Access + Refresh tokens
- MSSV login for students, email for admins
- Students blocked from email login
- Token rotation & refresh token DB storage (SHA-256 hashed)

---

## 2. ✅ RBAC Middleware: `hasRole()` (NEW)
**File**: `Backend/src/middlewares/authorize.ts`

```typescript
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
```

**Usage**: `hasRole('SYSTEM_ADMIN')` or `hasRole('SYSTEM_ADMIN', 'PAGE_ADMIN')`

---

## 3. ✅ GET /api/v1/users/me - Profile with Events (ENHANCED)

### Service: `Backend/src/modules/users/users.service.ts`
**New fields in response:**
- `participated_events`: ALL attended events with full details (title, time, location, points, category, page)
- `recent_events`: 5 most recent events (for UI)
- `attended_events_count`: Total count
- `training_points`: Current points from profile
- `badges`: Earned badges

### Response Structure:
```json
{
  "id": "uuid",
  "email": "user@utehy.edu.vn",
  "role": "STUDENT",
  "full_name": "Nguyen Van A",
  "student_id": "20210001",
  "class_name": "CNTT-01",
  "faculty": "Công nghệ thông tin",
  "phone": "0987654321",
  "avatar_url": "https://...",
  "training_points": 150,
  "attended_events_count": 12,
  "badges": [
    {
      "id": "1",
      "name": "Tân Binh",
      "description": "Tham gia 1 sự kiện đầu tiên",
      "icon_url": "https://...",
      "awarded_at": "2026-01-15T10:30:00.000Z"
    }
  ],
  "recent_events": [
    {
      "id": "uuid",
      "title": "Hội thảo AI",
      "start_time": "2026-05-10T08:00:00.000Z",
      "end_time": "2026-05-10T12:00:00.000Z",
      "location": "Hội trường A",
      "training_points": 15,
      "status": "CLOSED",
      "category": { "name": "Hội thảo", "color_hex": "#3b82f6" },
      "page": { "name": "CLB AI", "slug": "clb-ai", "avatar_url": "https://..." }
    }
  ],
  "participated_events": [
    {
      "registration_id": "uuid",
      "registered_at": "2026-04-20T10:00:00.000Z",
      "event": { ... }  // Full event details
    }
  ]
}
```

---

## 4. ✅ Excel Import: Bulk Student Creation (NEW)

### Endpoint: `POST /api/v1/users/import-students`
**Required Role**: `SYSTEM_ADMIN`

### Validation Schema (Zod):
```typescript
export const importStudentsSchema = z.object({
  students: z.array(z.object({
    student_id: z.string().min(1, 'MSSV không được để trống'),
    full_name: z.string().min(1, 'Họ tên không được để trống'),
    class_name: z.string().optional(),
    faculty: z.string().optional(),
    email: z.string().email('Email không hợp lệ').optional(),
    phone: z.string().optional(),
  })).min(1, 'Danh sách sinh viên không được để trống'),
});
```

### Request Body:
```json
{
  "students": [
    {
      "student_id": "20210001",
      "full_name": "nguyen van a",
      "class_name": "  cntt-01  ",
      "faculty": " công nghệ thông tin ",
      "email": "student@example.com",
      "phone": "0987654321"
    }
  ]
}
```

### Response:
```json
{
  "success": 150,
  "failed": 3,
  "errors": [
    {
      "row": 5,
      "student_id": "20210001",
      "message": "Đã tồn tại trong hệ thống"
    },
    {
      "row": 23,
      "student_id": "ABC",
      "message": "MSSV không hợp lệ: ABC"
    }
  ]
}
```

### Data Cleaning & Auto-Fill:

| Field | Processing |
|-------|-----------|
| **Names** | Trim, normalize spaces, capitalize words (`nguyen van a` → `Nguyen Van A`) |
| **MSSV** | Trim, remove zero-width chars, validate 8-10 digits |
| **Email** | Lowercase, trim; auto-generate `[MSSV]@student.utehy.edu.vn` if missing |
| **Phone** | Remove non-numeric chars, convert 84/+84 to 0 prefix, validate format |
| **Class** | Uppercase, trim |
| **Faculty** | Capitalize words, trim |

### Concurrency & Transactions:
- **Batch size**: 50 rows per transaction
- **Prisma $transaction**: Each batch is atomic
- **Row-level isolation**: Failure in one row doesn't block others
- **Duplicate detection**: Check MSSV and email before insert
- **Password**: `bcrypt.hash(MSSV, 12)` (default password = MSSV)

---

## Files Modified

1. ✅ `Backend/src/middlewares/authorize.ts` - Added `hasRole()`
2. ✅ `Backend/src/modules/users/users.schema.ts` - Added `importStudentsSchema`
3. ✅ `Backend/src/modules/users/users.controller.ts` - Added `importStudents()` endpoint
4. ✅ `Backend/src/modules/users/users.service.ts` - Enhanced `getUserProfile()` + Added `bulkCreateStudents()`
5. ✅ `Backend/src/modules/users/users.routes.ts` - Added `/import-students` route, updated to `hasRole()`

---

## API Routes Summary

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/api/v1/auth/login` | No | Any | Login with bcrypt |
| GET | `/api/v1/users/me` | ✅ | Any | Profile + events |
| POST | `/api/v1/users/import-students` | ✅ | SYSTEM_ADMIN | Bulk import Excel |
| PATCH | `/api/v1/users/me` | ✅ | Any | Update profile |
| POST | `/api/v1/users/me/change-password` | ✅ | Any | Change password |
| GET | `/api/v1/users/me/training-points` | ✅ | Any | Points history |
| GET | `/api/v1/users` | ✅ | SYSTEM_ADMIN | List users |
| PATCH | `/api/v1/users/:id/toggle-active` | ✅ | SYSTEM_ADMIN | Toggle active |
| GET | `/api/v1/users/:id` | ✅ | Any | User profile |

---

## Technical Highlights

✅ **Clean Architecture**: Controller (HTTP) ↔ Service (Business Logic)  
✅ **ES6+**: async/await, destructuring, arrow functions, spread operators  
✅ **Error Handling**: try/catch with HTTP status codes (400, 401, 403, 404, 500)  
✅ **Validation**: Zod schemas for all inputs  
✅ **Type Safety**: Full TypeScript with Prisma types  
✅ **Transactions**: `prisma.$transaction()` for multi-table writes  
✅ **Concurrency**: Batch processing (50 rows), row-level error isolation  
✅ **Security**: Bcrypt hashing, JWT, SHA-256 token storage, RBAC  
✅ **Data Cleaning**: Trim, normalize, validate, auto-fill, capitalize  
✅ **Real-world**: Pagination, duplicate detection, error logging, Unicode handling  

---

## Notes

- The `registrations.service.ts` has a pre-existing TypeScript error (unrelated to our changes)
- All new code follows existing project patterns and conventions
- Vietnamese error messages for user-facing content
- Consistent code style with existing codebase
