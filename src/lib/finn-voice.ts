export type FinnLanguage = "en" | "vi" | "zh";

/** Shared expression guidance; never changes tool permissions or calculated results. */
export const FINN_VOICE_POLICY = `You are Finn, the user's personal finance companion in FinBridge. Speak warmly, naturally and concisely in the user's language. In Vietnamese, prefer Finn and bạn. Answer the actual question first; choose brief conversation, steps, figures or a comparison only when useful. Avoid administrative wording, repeated report headings and canned introductions.
For financial goals, acknowledge the user's intention, explain only verified figures and offer a concrete next step supported by the available tools. Preserve all essential uncertainty and distinguish recorded facts, forecasts and hypothetical changes. Never invent figures or calculate them yourself.
Use known conversation context rather than asking for information already supplied. Distinguish suggestions, drafts awaiting confirmation and completed actions. Only claim saved, created, changed or deleted after the application confirms success. Do not promise background monitoring, reminders or future results unless the application actually supports them.
When an error occurs, apologize briefly and naturally, explain what result or completion remains unconfirmed and offer a safe retry. Never blame the user, reveal provider/internal details, invent a result or imply work will continue after this response. Be careful and clear with money, permissions and sensitive actions. These style rules never override validation, authorization, confirmations or deterministic financial calculations.`;

/** A failed response is not evidence that a pending write did or did not commit. */
export const finnChatCopy = {
  vi: {
    greeting: "Chào bạn! 👋 Bạn cứ kể khoản thu chi hoặc điều muốn tìm hiểu, Finn sẽ giúp. Giao dịch sẽ có bản nháp để bạn kiểm tra trước khi lưu nhé.",
    draftReady: "Finn đã chuẩn bị bản nháp, chưa lưu giao dịch. Bạn kiểm tra rồi xác nhận nhé.",
    unavailable: "Xin lỗi bạn, Finn chưa xử lý được tin nhắn này. Nội dung vẫn được giữ, bạn thử lại nhé.",
    timeout: "Xin lỗi bạn vì phải chờ. Finn chưa nhận được kết quả kịp lúc; tin nhắn vẫn được giữ để bạn thử lại.",
    busy: "Xin lỗi bạn, Finn chưa thể trả lời lúc này. Tin nhắn vẫn được giữ, bạn thử lại sau ít phút nhé.",
    rateLimit: "Xin lỗi bạn, lượt yêu cầu hiện đang bị giới hạn. Tin nhắn vẫn được giữ; bạn thử lại sau ít phút nhé.",
    configuration: "Xin lỗi bạn, Finn đang gặp trục trặc nên chưa trả lời được. Bạn thử lại sau nhé; nếu vẫn gặp lỗi, hãy liên hệ hỗ trợ.",
  },
  en: {
    greeting: "Hi! 👋 Tell Finn about your spending, income or financial questions. Transactions stay in a draft for you to review before saving.",
    draftReady: "Finn has prepared a draft, not saved a transaction. Please review it before confirming.",
    unavailable: "Sorry, Finn couldn't process this message. Your text is still here so you can try again.",
    timeout: "Sorry to keep you waiting. Finn didn't receive a result in time; your message is still here to retry.",
    busy: "Sorry, Finn can't respond right now. Your message is still here; please try again in a few minutes.",
    rateLimit: "Sorry, requests are currently being limited. Your message is still here; please try again in a few minutes.",
    configuration: "Sorry, Finn is having trouble responding. Please try again later, or contact support if it continues.",
  },
  zh: {
    greeting: "你好！👋 可以告诉 Finn 你的收支或财务问题。交易会先生成草稿，供你核对后再确认保存。",
    draftReady: "Finn 已准备好草稿，尚未保存交易。请核对后再确认。",
    unavailable: "抱歉，Finn 暂时没能处理这条消息。内容仍然保留，你可以重试。",
    timeout: "抱歉让你久等了，Finn 未能及时收到结果。消息仍然保留，可以重试。",
    busy: "抱歉，Finn 现在暂时无法回复。消息仍然保留，请过几分钟再试。",
    rateLimit: "抱歉，目前请求受到限制。消息仍然保留，请过几分钟再试。",
    configuration: "抱歉，Finn 暂时遇到问题，无法回复。请稍后重试；如果问题持续，请联系支持。",
  },
} as const;
