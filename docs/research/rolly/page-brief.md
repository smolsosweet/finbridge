# Rolly Web App — inspection brief

## Scope

- Source inspected: https://app.rollyapp.ai/ on 12 October 2026, authenticated Vietnamese empty-wallet session.
- Local implementation: /app and its child routes in this project.
- The source is a Flutter Web application. Its observed app data endpoints are hosted by Supabase. This project deliberately does not reuse source application code, accounts, API calls, or user data.

## Observed visual system

- Inter family (regular, medium and semibold), near-white #f9f9f9 canvas, white cards, charcoal type, teal active state, pink/red expenses and green income.
- Fluid desktop layout with 20–25 px outer gutters; four-item fixed bottom navigation (Home, Transactions, Money tools, Settings).
- Source Lottie assets are used for the pink Rolly mascot, the yellow empty-state box, trophy, and personality variant where available.
- Responsive verification used desktop 1920×930 and phone 393×852 viewports. Bottom navigation stays fixed; long tool tabs scroll horizontally on narrow screens.

## Routes and interactions reproduced

| Area | Local route / interaction |
| --- | --- |
| Home and Transactions | /app, /app?tab=transactions; wallets, period and month/range selection, search, totals, calendar, empty and populated records |
| Money tools | /app/budget, /app/savings, /app/debt, /app/loanList, /app/challenge; filters, create forms, details, progress and local persistence |
| AI budget | /app/budgetwithAIEntry; source-matching income/lifestyle/cycle form and local 50/30/20 plan calculation |
| Transaction capture | /app/addTransactionChatMode, /app/addTransaction, /app/editTransaction, /app/recurringTransaction; typed parsing, browser voice UI, receipt attachment, transfer sheet, recurring schedules, memory rules |
| Settings and wallet | /app?tab=settings, /app/accountSettings, /app/homepageConfiguration, /app/walletSettings, /app/walletDetailsEdit, /app/createWallet1 |
| Categories | /app/category, /app/categoryDetail; expense/income tabs, subcategories, edit/delete/create flows and icon picker groups |
| Supporting screens | /app/calendar, /app/milestones, /app/featureRequest, /app/featureRequestCompleted, /app/paywall7dTrial |

## Functional boundaries

All created wallets, records, goals, settings, categories and rules are stored only in browser local storage under rolly-replica-v2.

The following source capabilities need a real backend or browser permission and are intentionally presented as local UI or clearly labelled handoffs: Google authentication, cloud synchronisation/sharing/invites, email receipt forwarding, server-side receipt OCR and AI analysis, payment/checkout, biometrics, push notifications, external contact/terms/privacy pages and real voice permission. No real Rolly account data is sent or copied.

## Assets captured

- public/sites/rolly/jsons/: cheerleader, nagging-mom, empty_list, Trophy
- public/sites/rolly/fonts/: Inter weights, source Font Awesome subset/full fallback and Material Icons
- Existing supplied/recovered illustrations remain under public/sites/rolly/images/.

## Verification

npm run lint, npm run typecheck and npm run build all pass after this implementation.
