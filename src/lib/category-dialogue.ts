import { z } from "zod";
import type { AppState } from "../components/finbridge/workspace/store";
import { categoryCommandSchema, prepareCategoryOperation, type CategoryCommand } from "./category-operations";
import { categoryOperationError } from "./category-operation-copy";

type Language = "en" | "vi" | "zh";
type CategoryState = Pick<AppState, "categories" | "categoryMeta">;
export const categoryChoiceSchema = z.object({ field: z.enum(["sources", "target", "type"]), value: z.string().min(1).max(100) }).strict();
export type CategoryChoice = z.infer<typeof categoryChoiceSchema>;
export const categoryDialogueSchema = z.object({
  id: z.string().uuid(), command: categoryCommandSchema, status: z.enum(["collecting","cancelled"]).optional(), field: z.enum(["sources", "target", "type"]), question: z.string().max(600),
  choices: z.array(z.object({ label: z.string().max(100), value: z.string().max(100) }).strict()).max(500), error: z.string().max(600).optional(),
}).strict();
export type CategoryDialogue = z.infer<typeof categoryDialogueSchema>;

/** Parameter collection only. Names are revalidated against the owned workspace. */
export function inspectCategoryDialogue(raw: CategoryCommand, state: CategoryState, language: Language, id: string, error?: string): CategoryDialogue | null {
  const command = categoryCommandSchema.parse(raw);
  const active = state.categories.filter(name => !state.categoryMeta[name]?.archived && name !== "Chưa được phân loại");
  const sameType = (name: string) => !command.type || (state.categoryMeta[name]?.type || "expense") === command.type;
  const unknownSources = command.sources.some(name => !active.includes(name));
  let field: CategoryChoice["field"] | null = command.operation === "create_category" ? !command.target ? "target" : !command.type ? "type" : null
    : !command.sources.length || unknownSources ? "sources" : command.operation !== "delete_category" && !command.target ? "target" : null;
  if (unknownSources) command.sources = command.sources.filter(name => active.includes(name));
  if (command.operation !== "create_category" && command.sources.length && !command.type) command.type = state.categoryMeta[command.sources[0]]?.type === "income" ? "income" : "expense";
  if (!field && !error) return null;
  field ||= command.operation === "delete_category" ? "sources" : "target";
  const copy = {
    vi: { name: "Bạn muốn đặt tên danh mục mới là gì?", sources: "Bạn muốn thao tác với danh mục nào? Chọn bên dưới hoặc nhắn tên danh mục.", mergeSources: "Bạn muốn gộp những danh mục nào? Chọn danh mục nguồn bên dưới hoặc nhắn các tên nguồn.", mergeTarget: `Bạn muốn gộp ${command.sources.map(n => `“${n}”`).join(", ")} vào danh mục nào?`, rename: "Bạn muốn đổi thành tên gì?", type: "Danh mục này dùng cho khoản chi hay khoản thu?", expense: "Chi tiêu", income: "Thu nhập" },
    en: { name: "What would you like to name the new category?", sources: "Which category do you mean? Choose below or send its name.", mergeSources: "Which categories should be merged? Choose a source below or send the source names.", mergeTarget: `Which category should ${command.sources.map(n => `“${n}”`).join(", ")} be merged into?`, rename: "What should the new name be?", type: "Is this category for expenses or income?", expense: "Expenses", income: "Income" },
    zh: { name: "新类别叫什么名字？", sources: "你指哪个类别？请在下方选择或发送名称。", mergeSources: "要合并哪些类别？请选择源类别或发送源类别名称。", mergeTarget: `要将${command.sources.map(n => `“${n}”`).join("、")}合并到哪个类别？`, rename: "要改成什么名称？", type: "此类别用于支出还是收入？", expense: "支出", income: "收入" },
  }[language];
  const choices = field === "type" ? [{ label: copy.expense, value: "expense" }, { label: copy.income, value: "income" }]
    : field === "sources" ? active.filter(sameType).map(name => ({ label: name, value: name }))
    : command.operation === "merge_categories" ? active.filter(name => sameType(name) && !command.sources.includes(name)).map(name => ({ label: name, value: name })) : [];
  let question = field === "sources" ? command.operation === "merge_categories" ? copy.mergeSources : copy.sources : field === "type" ? copy.type : command.operation === "merge_categories" ? copy.mergeTarget : command.operation === "rename_category" ? copy.rename : copy.name;
  if (command.operation === "merge_categories" && !choices.length) question = {vi:"Chưa có danh mục cùng loại phù hợp để chọn. Bạn có thể đổi nguồn/đích hoặc tạo thêm danh mục trước khi gộp.",en:"There is no eligible category of the same type to choose. Change the sources/destination, or create a category before merging.",zh:"目前没有可选的同类型类别。请更改源/目标类别，或先创建类别再合并。"}[language];
  return { id, command, field, question:question.slice(0,600), choices, ...(error ? { error } : {}) };
}

export function resolveCategoryChoice(pending: CategoryCommand, choice: CategoryChoice, state: CategoryState, language: Language, id: string): CategoryCommand {
  const dialogue = inspectCategoryDialogue(pending, state, language, id);
  if (!dialogue || dialogue.field !== choice.field || !dialogue.choices.some(option => option.value === choice.value)) throw new Error("INVALID_CATEGORY_CHOICE");
  return categoryCommandSchema.parse({ ...dialogue.command, [choice.field]: choice.field === "sources" ? [choice.value] : choice.value });
}

export function categoryDialogueResult(command: CategoryCommand, state: AppState, language: Language, id: string) {
  let dialogue = inspectCategoryDialogue(command, state, language, id);
  if (dialogue) return { categoryDialogue: dialogue, categoryOperation: null, reply: dialogue.question };
  try { prepareCategoryOperation(state, command, id); }
  catch (error) {
    dialogue = inspectCategoryDialogue(command, state, language, id, categoryOperationError(error, language));
    return { categoryDialogue: dialogue, categoryOperation: null, reply: `${dialogue?.error} ${dialogue?.question}` };
  }
  return { categoryDialogue: null, categoryOperation: command, reply: "" };
}
