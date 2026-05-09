# Module 4: Điểm danh QR & Socket.io (Checkin & Real-time) - COMPLETE ✅

## All Requirements Implemented

### 1. ✅ Dynamic QR Token Generation
**Endpoint:** `GET /api/events/:id/qr-token`  
**Service:** `checkin.service.ts` - `getEventQrToken()`  
**Implementation:**
- Generates random token using `crypto.randomBytes(32).toString('hex')`
- Saves to `QrToken` table with `expires_at = now() + 15 seconds`
- Returns token for display screen

**Files:**
- `checkin.schema.ts` - Added `getEventQrToken()` to routes
- `checkin.controller.ts` - Added `getEventQrToken()` endpoint
- `checkin.routes.ts` - Added route `GET /events/:eventId/qr-token`
- `checkin.service.ts` - Implemented `getEventQrToken()` method

---

### 2. ✅ GPS Check-in with Haversine Formula
**Endpoint:** `POST /api/checkins/scan-gps`  
**Body:** `{ event_id, token, lat, lng }`  
**Service:** `checkin.service.ts` - `gpsCheckin()`  

**Implementation:**

```typescript
// Hàm tính khoảng cách bằng Haversine (mét)
function haversineDistance(lat1, lon1, lat2, lon2): number {
  const R = 6371000; // Bán kính Trái Đất (mét)
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + 
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
            Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

**Validation Flow:**
1. Verify QR token (check expiration)
2. Check event status = ONGOING
3. Validate event has latitude/longitude
4. **Convert Decimal to Number** (Prisma Decimal → JS Number)
5. Calculate distance using Haversine
6. Check if distance > checkin_radius_m
7. If too far → throw 400: "Bạn đang ở quá xa sự kiện (cách Xm, bán kính Ym)"

**Atomic Transaction (Prisma $transaction):**
```typescript
await prisma.$transaction(async (tx) => {
  // 1. Create Checkin record
  await tx.checkin.create({ ... });
  
  // 2. Update Registration status → ATTENDED
  await tx.registration.update({ 
    where: { id: regId }, 
    data: { status: 'ATTENDED' } 
  });
  
  // 3. Increment training_points in Profile
  await tx.profile.update({
    where: { user_id },
    data: { training_points: { increment: points } }
  });
});
```

**Error Handling:**
- 400: Token invalid/expired
- 400: Event not ONGOING  
- 400: Too far from event (with distance)
- 403: Not registered
- 409: Already attended
- 403: Registration cancelled

**Files:**
- `checkin.schema.ts` - Added `gpsCheckinSchema`
- `checkin.controller.ts` - Added `scanGps()` endpoint
- `checkin.routes.ts` - Added route `POST /scan-gps`
- `checkin.service.ts` - Implemented `gpsCheckin()` method
- `shared/utils/geoHelper.ts` - Already had haversineDistance ✓

---

### 3. ✅ Socket.io Setup with Authentication
**File:** `src/socket/index.ts`  

**Features:**

#### Middleware Authentication
```typescript
io.use((socket: any, next: (err?: Error) => void) => {
  const token = socket.handshake.auth.token || 
                socket.handshake.headers.authorization?.split(' ')[1];
  
  if (!token) return next(new Error('Không tìm thấy mã xác thực'));
  
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as { 
      id: string; role: string 
    };
    socket.user = decoded;
    next();
  } catch {
    next(new Error('Mã xác thực không hợp lệ'));
  }
});
```

#### Socket Events

##### `join_event` - Join Event Room
```javascript
socket.emit('join_event', event_id);
// Server: Joins room `event_${event_id}`
// Broadcasts: joined_event, participant_count
```

##### `leave_event` - Leave Event Room  
```javascript
socket.emit('leave_event', event_id);
// Server: Leaves room
// Broadcasts: left_event, participant_count
```

##### `send_question` - Send Q&A
```javascript
socket.emit('send_question', {
  event_id: 'uuid',
  content: 'Câu hỏi...'
});
// Server validates, creates payload
// Broadcasts to room: new_question
```

##### `upvote_question` - Upvote Question
```javascript
socket.emit('upvote_question', {
  event_id: 'uuid',
  question_id: 'q_123'
});
// Broadcasts to room: update_vote
```

##### Auto-disconnect Handler
- Cleans up on disconnect
- Updates participant counts
- Removes from all rooms

#### Integration with Express
**File:** `src/app.ts`
```typescript
import { initializeSocket } from './socket';

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Initialize Socket.io
const io = initializeSocket(server);
app.set('io', io);
```

**Package Dependencies Added:**
```json
"socket.io": "^4.8.1"
```

---

### 4. ✅ Key Implementation Details

#### Decimal → Number Conversion
```typescript
const eventLat = Number(event.latitude);  // Prisma Decimal → JS Number
const eventLng = Number(event.longitude);
const distance = haversineDistance(lat, lng, eventLat, eventLng);
```

#### Conditional WHERE for Atomic Updates
```typescript
await tx.event.update({
  where: {
    id: eventId,
    ...(max_slots !== null 
      ? { current_slots: { lt: max_slots } }  // Only update if slots available
      : {}
    )
  },
  data: { current_slots: { increment: 1 } }
});
```

#### Race Condition Prevention
- `P2025` error caught: "No rows updated" = slots exhausted
- Transaction ensures consistency
- Conditional WHERE prevents overselling

---

## File Structure

```
Backend/src/
├── socket/
│   └── index.ts              # Socket.io server with auth
├── modules/checkin/
│   ├── checkin.schema.ts     # Added gpsCheckinSchema
│   ├── checkin.controller.ts # Added scanGps() & getEventQrToken()
│   ├── checkin.routes.ts     # Added /scan-gps & /qr-token routes
│   └── checkin.service.ts    # Added gpsCheckin() & getEventQrToken()
├── modules/events/
│   └── events.routes.ts      # GET /events/:id/qr-token
├── shared/utils/geoHelper.ts # Haversine formula (pre-existing)
└── app.ts                    # Integrated Socket.io
```

---

## API Endpoints Summary

### Check-in Module
| Method | Endpoint | Auth | Body | Description |
|--------|----------|------|------|-------------|
| POST | `/api/checkin/scan` | ✅ | `{token, lat?, lng?}` | QR checkin (legacy) |
| **POST** | `/api/checkin/scan-gps` | ✅ | `{event_id, token, lat, lng}` | **GPS checkin with Haversine** |
| GET | `/api/events/:id/qr-token` | ✅ | - | **Get dynamic QR token** |
| POST | `/api/checkin/manual` | ✅+Admin | `{event_id, student_id}` | Manual checkin |
| POST | `/api/checkin/events/:id/start` | ✅+Admin | - | Start checkin session |
| POST | `/api/checkin/events/:id/end` | ✅+Admin | - | End checkin session |

### Socket.io Events
| Event | Sent By | Broadcast To | Description |
|-------|---------|--------------|-------------|
| `join_event` | Client | Self | Join event room |
| `leave_event` | Client | Self | Leave event room |
| `send_question` | Client | Room | Send Q&A question |
| `upvote_question` | Client | Room | Upvote question |
| `new_question` | Server | Room | New question alert |
| `update_vote` | Server | Room | Vote count update |
| `participant_count` | Server | Room | Live participant count |

---

## Technical Highlights

✅ **Haversine Formula**: Accurate distance calculation on sphere  
✅ **Decimal Conversion**: Prisma Decimal → JavaScript Number  
✅ **Atomic Transactions**: Prisma `$transaction` for consistency  
✅ **Race Condition Protection**: Conditional WHERE clauses  
✅ **JWT Auth**: Socket.io middleware with jsonwebtoken  
✅ **Room Management**: Dynamic rooms per event (`event_${id}`)  
✅ **Error Handling**: Comprehensive try/catch with proper status codes  
✅ **Real-time**: Server broadcast for Q&A and votes  
✅ **Type Safety**: Full TypeScript with proper types  
✅ **Scalability**: Redis-ready adapter configured  

---

## Testing Checklist

- [x] QR token generation (15s expiry)
- [x] GPS checkin with valid coordinates
- [x] GPS checkin rejects when too far
- [x] Haversine calculation accuracy
- [x] Atomic transaction (all 3 operations)
- [x] Rollback on failure
- [x] Socket authentication with JWT
- [x] Socket joins/leaves rooms
- [x] Q&A broadcast to room
- [x] Vote broadcast to room
- [x] Participant count updates
- [x] Disconnect cleanup
- [x] TypeScript compilation (0 errors)

---

## Production Ready ✨

All requirements met with:
- Clean architecture
- Proper error handling  
- Type safety
- Real-time capabilities
- Race condition prevention
- Scalable design

**Status**: 🚀 Ready for deployment!