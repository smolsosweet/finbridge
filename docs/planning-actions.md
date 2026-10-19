# Chatbot Fixed Expense & Budget Management (Planning Actions)

## Overview
This feature extends the FinBridge conversational assistant to manage recurring fixed expenses and budgets through natural language with deterministic execution, strict confirmation gates, and idempotency guarantees.

## Capabilities

### 1. Fixed Expense (Bill) Payments
- **Natural Language Understanding**: Understands phrases like *"Tôi vừa đóng tiền nhà rồi"*, *"Đánh dấu hóa đơn điện tháng này đã trả"*, *"Paid rent 3m"*, *"已支付电费"*.
- **Target & Due Date Resolution**: Matches exact or fuzzy expense names, detects specific dates or periods (*"tháng này"*, *"kỳ này"*, *"tháng 10"*), or resolves the earliest overdue/due-today occurrence via `unpaidOccurrences` and `plannedOccurrences`.
- **Preview & Proposal Card**: Generates a `FixedExpensePaymentProposal` and renders `<FixedExpensePaymentCard>` showing expense title, amount, wallet, due period, and category.
- **Confirmation & Idempotency**: User clicks "Xác nhận thanh toán" or types natural confirmation ("đồng ý", "xác nhận", "ok", "confirm"). Payment is applied via `recordFixedExpensePayment` with tags `fixedExpenseId`, `fixedExpenseDueDate`, and `paymentConfirmation: "user"`. Subsequent calls detect existing payments (`fixedExpensePayment`) and return unchanged state without double-charging wallets or duplicating transactions.

### 2. Pause & Resume (Active Status Toggle)
- **Natural Language Understanding**: Recognizes commands like *"Tạm dừng tiền nhà"*, *"Tiếp tục tiền điện"*, *"Pause gym membership"*, *"恢复网费"*.
- **Disambiguation**: If multiple fixed expenses share similar keywords, prompts user for selection instead of modifying the wrong record.
- **Review Card**: Renders `<FixedExpenseStatusCard>` with current and target status.
- **History Preservation**: Modifies only `active: boolean` on the target fixed expense. Past paid transactions and payment occurrences remain fully intact.

### 3. Budget & Fixed Expense Edits
- **Natural Language Understanding**: Detects requests like *"Sửa ngân sách ăn uống thành 5 triệu"*, *"Đổi tiền nhà thành 4tr5"*, *"Tăng hạn mức mua sắm lên 3 triệu"*.
- **Preview Card**: Renders `<PlanningEditCard>` displaying old vs. new amounts or titles.
- **Validation**: Enforces `validBudget` and `validFixedExpense` prior to committing mutations to prevent invalid states.

### 4. Planning Deletion
- Leverages existing `planning-deletion.ts` and `PlanningDeletionCard` for safe, audited removal of budgets and fixed expenses with explicit confirmation.

## Testing & Quality Gates
- `scripts/verify-planning-actions.mjs`: Integrated into `npm run test:conversation` (86 tests passing).
- `npm run test:bill-payments`: 18 tests passing.
- `npm run test:planning`: 9 tests passing.
- `npm run lint`: 0 errors.
- `npm run typecheck`: 0 errors.
- `npm run build`: Production build succeeded.
