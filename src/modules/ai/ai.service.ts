import { GoogleGenerativeAI } from '@google/generative-ai';
import cloudinary from '../../config/cloudinary';
import { env } from '../../config/env';

// Khởi tạo Gemini client
const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

// Types for Google Imagen API response
interface ImagenPrediction {
  bytesBase64Encoded: string;
}

interface ImagenResponse {
  predictions: ImagenPrediction[];
}

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

         const model = genAI.getGenerativeModel({ model: 'gemini-flash-lite-latest', generationConfig: { responseMimeType: "application/json" } });

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

          const model = genAI.getGenerativeModel({ model: 'gemini-flash-lite-latest', generationConfig: { responseMimeType: "application/json" } });

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
        throw new Error(error?.message || 'Không thể xử lý phản hồi từ AI');
      }
    },

    // ── TẠO POSTER SỰ KIỆN (GOOGLE IMAGEN) ───────────────────────
    async generateEventPoster(description: string) {
      try {
        // 1. Tối ưu prompt với hướng dẫn thiết kế
        const optimizedPrompt = `${description}. A modern, elegant digital background. Use a smooth, high-quality gradient color scheme featuring vibrant green, deep blue, gold, and clean white. STRICTLY NO TEXT, NO WORDS, NO LETTERS, NO NUMBERS, AND NO LOGOS IN THE IMAGE. Leave ample empty negative space for future text overlay.`;

        // 2. Gọi Google Imagen API trực tiếp qua fetch
        const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${env.GEMINI_API_KEY}`;

        const response = await fetch(imagenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            instances: [
              {
                prompt: optimizedPrompt,
              },
            ],
            parameters: {
              sampleCount: 1,
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({})) as any;
          throw new Error(`Google Imagen API lỗi ${response.status}: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json() as ImagenResponse;

        // Kiểm tra cấu trúc response
        if (!data.predictions || !data.predictions[0] || !data.predictions[0].bytesBase64Encoded) {
          throw new Error('Google Imagen API không trả về dữ liệu ảnh hợp lệ');
        }

        // 3. Lấy chuỗi Base64 và thêm prefix
        const base64Image = `data:image/jpeg;base64,${data.predictions[0].bytesBase64Encoded}`;

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