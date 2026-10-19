# Finn: financial planning and conversational actions

## Verified gaps and changes

- Scenario clarification was rendered without retaining the complete typed
  interpretation. `assistant-response.ts`, the assistant route, chat message
  metadata and `chat-local-plan.ts` now retain pending hypothetical inputs and
  the question. A short answer can complete the same scenario in one model call.
- The legacy normalizer could infer a purchase from a number even when structured
  output explicitly contained `actions: []`. Explicit empty actions now take
  precedence; legacy inference remains available for unstructured legacy input.
- Scenario calculations did not expose saved protected reserves. They now reuse
  `reserveAmounts()` and return the reserve separately from projected balance and
  spendable cash. An explicitly requested reserve override remains hypothetical.
  Reserves are not deducted as payments, stored as expenses or saved to settings.
- A partial `trackedBalance()` could appear as a numeric forecast. Results now
  identify an incomplete balance; chat answers and calculation details suppress
  that unverifiable monetary conclusion and ask the user to check source data.
- Locally rendered creation/category proposals were omitted from model history.
  Their status, entity references and question are now preserved. History never
  authorizes an action and does not transmit locally calculated balances.
- Responses can use a compact comparison table when requested by the model,
  show reserve gaps and distinguish wallet balances from budget limits. The
  existing escaped-text renderer renders accessible, horizontally scrollable
  tables; source calculations remain expandable. EN/VI/ZH remain supported.

## Main implementation files

- `src/lib/assistant-response.ts`
- `src/lib/scenario-planner.ts`
- `src/lib/scenario-answer.ts`, `src/lib/scenario-explanation.ts`
- `src/lib/chat-local-plan.ts`, `src/lib/category-operations.ts`
- `src/app/api/ai/assistant/route.ts`
- `src/components/sites/rolly/replica/Transactions.tsx`, `store.ts`
- `src/components/sites/rolly/replica/FinancialChatAnswer.tsx`, `replica.css`

## Verification

`npm run test:finn-planning-actions` covers the conversation changes alongside
existing scenario, category, management and confirmation regressions. New
calculation fixtures cover a 3,000 CNY hypothetical purchase, unpaid bills, spending
pace, saved/overridden/unset reserves, missing balances, CNY/RMB aliases, ambiguous
wallets, missing amounts, explicit cancellation of a hypothetical purchase,
comparison rendering and non-mutation before confirmation.

A broader offline run passed 234 tests, including spending plans, transaction
funding, category changes, bill payments and fixed-expense recurrence. Model
interpretations in these offline API tests are scripted; calculation and mutation
guard implementations are real. They do not establish arbitrary language coverage.

A separate live-model probe used the actual assistant route, synthetic CNY records
and the natural-language phone question. The configured model returned HTTP 503
after about 2.15 seconds, with one model call and unchanged fixture data. Therefore
live NLP acceptance and deployed Vercel behavior remain unverified. No model,
timeout, automatic write retry, data store or payment integration was changed.

## Short manual questions

Use wallet/category names that actually exist. Run follow-ups in sequence:

1. Nếu mua điện thoại 3.000 tệ, cuối tháng còn đủ tiền sống không?
2. Vậy mua loại 2.000 tệ thì sao?
3. Nhớ giữ lại 1.000 tệ dự phòng nhé.
4. Bỏ khoản mua đó, tính theo mức chi hiện tại thôi.
5. Tạo giúp mình một ví CNY tên Du học.
6. Lập ngân sách ăn uống 1.500 tệ cho tháng này.
7. Gộp danh mục Ăn vặt vào Ăn uống.
8. Tìm giao dịch ăn sáng hôm qua để mình xóa.

Missing data must cause a focused clarification, never invented funds. Management
requests must show a proposal and require confirmation before any persisted change.
