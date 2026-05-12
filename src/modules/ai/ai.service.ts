import { GoogleGenerativeAI } from '@google/generative-ai';
import cloudinary from '../../config/cloudinary';
import prisma from '../../config/database';
import { env } from '../../config/env';

// Khởi tạo Gemini client
const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

// Type for Cloudinary upload response
interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
}

// Helper: bóc tách JSON từ text có thể chứa markdown code block
function extractJsonFromString(text: string): string {
  // Loại bỏ markdown code fence: ```json ... ``` hoặc ``` ... ```
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  return cleaned.trim();
}

export const aiService = {

   // ── TẠO NỘI DUNG SỰ KIỆN (PAGE_ADMIN) ───────────────────────
   async generateEventContent(prompt: string) {
     try {
       // System prompt: chuyên gia Marketing sự kiện cho sinh viên
       const systemPrompt = `
 Bạn là một chuyên gia Marketing sự kiện chuyên nghiệp, có kinh nghiệm viết bài giới thiệu sự kiện thu hút sinh viên.
 Nhiệm vụ: Dựa trên từ khóa/chủ đề được cung cấp, hãy viết một bài viết giới thiệu sự kiện hấp dẫn, sinh động, phù hợp với đối tượng sinh viên.

 Yêu cầu:
 1. Tiêu đề (title): Giật tít, thu hút, dùng từ ngữ mạnh, kèm emoji phù hợp
 2. Mô tả (description): Nội dung chi tiết, hấp dẫn, chia thành các đoạn rõ ràng. Dùng nhiều emoji để tăng tính trực quan.
 3. Tags (tags): Mảng các từ khóa/tag phù hợp (3-5 tags), bao gồm: loại sự kiện, đối tượng, chủ đề

 Trả về CHÍNH XÁC JSON sau (không thêm text nào khác):
 {
   "title": "Tiêu đề hấp dẫn với emoji",
   "description": "Nội dung chi tiết với nhiều emoji và đoạn văn rõ ràng",
   "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
 }
 `;

          const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash', generationConfig: { responseMimeType: "application/json" } });

          const result = await model.generateContent([
            systemPrompt,
            `Từ khóa/Chủ đề: "${prompt}"`
          ]);

       const responseText = result.response.text();

       // Extract và Parse JSON
       const cleanedText = extractJsonFromString(responseText);
       const parsed = JSON.parse(cleanedText);

       // Validate required fields
       if (!parsed.title || !parsed.description || !parsed.tags) {
         throw new Error('JSON thiếu trường bắt buộc');
       }

       return {
         title: parsed.title,
         description: parsed.description,
         tags: Array.isArray(parsed.tags) ? parsed.tags : [],
       };

     } catch (error: any) {
       console.error('AI Service Error Chi Tiết:', error?.message || error);
       // Graceful fallback cho lỗi 503
       if (error.message?.includes('503') || error?.status === 503) {
         return {
           title: 'Dịch vụ tạm thời không khả dụng',
           description: 'Xin lỗi, hệ thống AI hiện đang quá tải. Bạn vui lòng thử lại sau vài phút nhé!',
           tags: ['service-unavailable'],
         };
       }
       throw new Error(error?.message || 'Không thể xử lý phản hồi từ AI');
     }
   },

    // ── PHÂN TÍCH CHẤT LƯỢNG SỰ KIỆN (SYSTEM_ADMIN) ───────────
    async analyzeEventQuality(eventData: { title: string; description?: string; location?: string; organizer?: string }) {
      try {
        const { title, description, location, organizer } = eventData;

        // System prompt: Ban kiểm duyệt nhà trường
        const systemPrompt = `
 Bạn là một thành viên trong Ban kiểm duyệt nhà trường, chịu trách nhiệm xem xét và đánh giá các sự kiện sinh viên trước khi phê duyệt.
 Nhiệm vụ: Phân tích nội dung sự kiện để xác định xem có vi phạm thuần phong mỹ tục, bạo lực, spam, hoặc nội dung không phù hợp không.

 Tiêu chí đánh giá:
 1. Thuần phong mỹ tục: Có từ ngữ/thành ngữ khiêu dâm, xấu hổ, phản cảm không?
 2. Bạo lực: Có khuyến khích/hô hào bạo lực, đánh nhau, chiến tranh không?
 3. Spam/Quảng cáo: Có nội dung quảng cáo sản phẩm/dịch vụ thương mại, lừa đảo không?
 4. Độ an toàn: Có yêu cầu tham gia nguy hiểm, vi phạm pháp luật không?
 5. Tính phù hợp: Có phù hợp với môi trường học đường, sinh viên không?

 Trả về CHÍNH XÁC JSON sau:
 {
   "isSafe": true/false,
   "score": 1-100 (điểm chất lượng, càng cao càng an toàn/phù hợp),
   "reason": "Lý do giải thích chi tiết tại sao an toàn hoặc không an toàn"
 }
 `;

           const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash', generationConfig: { responseMimeType: "application/json" } });

           const eventInfo = `
 Tiêu đề: ${title}
 Mô tả: ${description || 'Không có mô tả'}
 Địa điểm: ${location || 'Không xác định'}
 Đơn vị tổ chức: ${organizer || 'Không xác định'}
       `.trim();

        const result = await model.generateContent([
          systemPrompt,
          eventInfo
        ]);

        const responseText = result.response.text();

        // Extract và Parse JSON
        const cleanedText = extractJsonFromString(responseText);
        const parsed = JSON.parse(cleanedText);

        // Validate required fields
        if (typeof parsed.isSafe !== 'boolean' || typeof parsed.score !== 'number') {
          throw new Error('JSON thiếu trường bắt buộc hoặc kiểu dữ liệu không đúng');
        }

         return {
           isSafe: parsed.isSafe,
           score: Math.max(1, Math.min(100, Math.round(parsed.score))),
           reason: parsed.reason || 'Không có lý do',
         };

      } catch (error: any) {
        console.error('AI Service Error Chi Tiết:', error?.message || error);
        // Graceful fallback cho lỗi 503
        if (error.message?.includes('503') || error?.status === 503) {
          return {
            isSafe: true,
            score: 50,
            reason: 'Không thể phân tích do hệ thống AI quá tải. Vui lòng thử lại sau.',
          };
        }
        throw new Error(error?.message || 'Không thể xử lý phản hồi từ AI');
      }
    },

    // ── CHATBOT TƯ VẤN SỰ KIỆN (STUDENT) ───────────────────────
    async generateChatResponse(userMessage: string) {
      try {
        // 1. Truy vấn sự kiện sắp diễn ra từ database
        const upcomingEvents = await prisma.event.findMany({
          where: { status: { in: ['APPROVED', 'ONGOING'] } },
          orderBy: { start_time: 'asc' },
          take: 5,
          select: {
            title: true,
            start_time: true,
            location: true,
            current_slots: true,
          },
        });

        // 2. Ép mảng sự kiện thành chuỗi Text
        const eventsContext = upcomingEvents.map(e =>
          `- ${e.title} (Lúc: ${e.start_time.toLocaleString('vi-VN')}, Tại: ${e.location})`
        ).join('\n');

        // 3. Tạo System Prompt kết hợp dữ liệu sự kiện
        const systemPrompt = `Bạn là Trợ lý AI của trường UTEHY, hỗ trợ tư vấn sinh viên về các sự kiện của trường.

Dưới đây là các sự kiện sắp tới đang mở đăng ký (cập nhật thời gian thực):
${eventsContext || 'Không có sự kiện nào sắp diễn ra.'}

Nhiệm vụ:
- Trả lời câu hỏi của sinh viên dựa trên thông tin sự kiện thực tế ở trên.
- Nếu câu hỏi liên quan đến sự kiện không có trong danh sách, hãy đề nghị sinh viên tham khảo website hoặc liên hệ ban tổ chức.
- Giọng điệu: thân thiện, chuyên nghiệp, dùng emoji hợp lý.

Câu hỏi của sinh viên: ${userMessage}`;

        // 4. Gọi Gemini với model ổn định
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent(systemPrompt);

        // 5. Trả về text đơn giản
        return result.response.text();

      } catch (error: any) {
        console.error('Lỗi Gemini API (Chatbot):', error);
        // Graceful fallback: không làm crash app
        return 'Xin lỗi, hệ thống AI hiện đang quá tải. Bạn vui lòng thử lại sau vài phút nhé!';
      }
    },

    // ── TẠO POSTER SỰ KIỆN (GOOGLE IMAGEN) ───────────────────────
    async generateEventPoster(description: string) {
      try {
        // 1. Tối ưu prompt với hướng dẫn thiết kế
        const fullPrompt = `A breathtaking, premium blank event background matching the theme: ${description}. High-end digital art, 3D abstract fluid waves using elegant green, deep blue, sparkling gold, and clean white gradients. Cinematic lighting, 8k resolution, highly detailed, masterpieces. STRICTLY NO TEXT, NO WORDS, NO LETTERS, NO NUMBERS, NO WATERMARKS, AND NO LOGOS. Leave the center completely empty and clean for typography overlay.`;

        // 2. Gọi Pollinations AI API (GET, không cần API Key)
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=1024&height=576&nologo=true`;

        const response = await fetch(url, {
          method: 'GET',
        });

        if (!response.ok) {
          throw new Error(`Pollinations API lỗi ${response.status}: ${response.statusText}`);
        }

        // 3. Lấy ArrayBuffer và chuyển sang Base64
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Data = buffer.toString('base64');
        const base64Image = `data:image/jpeg;base64,${base64Data}`;

        // 4. Upload lên Cloudinary
        const uploadResult = await new Promise<CloudinaryUploadResult>((resolve, reject) => {
          cloudinary.uploader.upload(base64Image, {
            folder: 'utehy_social/event_posters',
            resource_type: 'image',
            format: 'jpg',
          }, (error, result) => {
            if (error) reject(error);
            else resolve(result as CloudinaryUploadResult);
          });
        });

        return {
          success: true,
          imageUrl: uploadResult.secure_url,
          cloudinaryPublicId: uploadResult.public_id,
        };

      } catch (error: any) {
        console.error('AI Service - Generate Event Poster Error:', error);
        throw new Error(error?.message || 'Không thể tạo poster sự kiện');
      }
    },

  };