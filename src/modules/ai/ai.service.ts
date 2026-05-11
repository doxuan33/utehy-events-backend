import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../../config/env';
import { sendError } from '../../shared/utils/response';

// Khởi tạo Gemini client
const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

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

      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const result = await model.generateContent([
        systemPrompt,
        `Từ khóa/Chủ đề: "${prompt}"`
      ]);

      const responseText = result.response.text();

      // Parse JSON từ response
      let jsonStart = responseText.indexOf('{');
      let jsonEnd = responseText.lastIndexOf('}') + 1;
      
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('AI không trả về JSON hợp lệ');
      }

      const jsonString = responseText.substring(jsonStart, jsonEnd);
      const parsed = JSON.parse(jsonString);

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
      console.error('Error generating event content:', error);
      throw sendError(null, 'Lỗi khi tạo nội dung: ' + error.message, 500);
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

      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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

      // Parse JSON từ response
      let jsonStart = responseText.indexOf('{');
      let jsonEnd = responseText.lastIndexOf('}') + 1;
      
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('AI không trả về JSON hợp lệ');
      }

      const jsonString = responseText.substring(jsonStart, jsonEnd);
      const parsed = JSON.parse(jsonString);

      // Validate required fields
      if (typeof parsed.isSafe !== 'boolean' || typeof parsed.score !== 'number') {
        throw new Error('JSON thiếu trường bắt buộc hoặc kiểu dữ liệu không đúng');
      }

      return {
        isSafe: parsed.isSafe,
        score: Math.max(1, Math.min(100, Math.round(parsed.score))), // Clamp 1-100
        reason: parsed.reason || 'Không có lý do',
      };

    } catch (error: any) {
      console.error('Error analyzing event:', error);
      throw sendError(null, 'Lỗi khi phân tích sự kiện: ' + error.message, 500);
    }
  },
};
