import { planTransferChat, mergeTransferChatRequest } from "./transfer-chat";
import { transferServices } from "./transfer-services";
import { transferChatCopy, type TransferChatRequest, type TransferChatResult } from "./transfer-chat-model";
import type { ScenarioLanguage } from "./scenario-format";

export async function readTransferChat(input: { owner: string; demo: boolean; request: TransferChatRequest; previous?: TransferChatRequest; id: string; language: ScenarioLanguage }): Promise<TransferChatResult> {
  const request = mergeTransferChatRequest(input.request, input.previous);
  try {
    const result = await planTransferChat(input.owner, request, input.id, input.language, transferServices(input.demo));
    const more = result.rows.length > 200 || result.choices.length > 200;
    return { ...result, rows: result.rows.slice(0,200).map(r=>({label:r.label.slice(0,220),value:r.value.slice(0,800)})), choices: result.choices.slice(0,200).map(c=>({...c,label:c.label.slice(0,220)})), ...(more ? { text: result.text + " " + ({ vi: "Hiển thị 200 mục đầu; mở tab để xem thêm.", en: "Showing the first 200 items; open the tab for more.", zh: "显示前200项，更多记录请打开汇款页面。" }[input.language]) } : {}) };
  } catch {
    return { id: input.id, request, status: "failed", title: transferChatCopy[input.language].title, text: transferChatCopy[input.language].unavailable, rows: [], choices: [], sandbox: !["rates","convert","estimates","save_estimate"].includes(request.operation) };
  }
}
