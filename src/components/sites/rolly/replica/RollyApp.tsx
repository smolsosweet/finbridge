"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Dashboard } from "./Dashboard";
import { TransactionHistory } from "./TransactionHistory";
import { Planning } from "./Planning";
import { BudgetAI, GoalDetails, GoalForm, ToolPage, tools } from "./Tools";
import { AccountSettings, HomepageConfiguration, WalletScreen } from "./Settings";
import { SettingsOverview } from "./SettingsOverview";
import { ChatPage, RecurringPage, TransactionForm } from "./Transactions";
import { CalendarPage, CompletedRequests, FeatureRequests, PremiumPage } from "./Extras";
import { Icon, PageHeader } from "./Ui";
import { useAppState } from "./store";
import { WelcomeScreen } from "../WelcomeScreen";
import { Categories } from "./Categories";
import "./replica.css";

export function RollyApp({ screen = "" }: { screen?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const state = useAppState();
  const tab = params.get("tab") || "home";
  const navigate = (path: string) => {
    if (path === "support") { window.open("https://rollyapp.ai/vi/lien-he", "_blank", "noopener"); return; }
    if (path === "terms") { window.open("https://rollyapp.ai/terms-and-conditions", "_blank", "noopener"); return; }
    if (path === "privacy") { window.open("https://rollyapp.ai/privacy-policy", "_blank", "noopener"); return; }
    router.push("/app" + (path ? (path.startsWith("?") ? "" : "/") + path : ""));
  };
  const theme = state.settings.theme === "system" ? "r-system-theme" : state.settings.theme === "dark" ? "r-dark" : "";
  let content;
  if (!screen) content = tab === "tools" ? <Planning navigate={navigate} /> : tab === "settings" ? <SettingsOverview navigate={navigate} /> : tab === "transactions" ? <TransactionHistory navigate={navigate} /> : <Dashboard key={tab} navigate={navigate} />;
  else if (["budget", "savings", "fixedExpenses", "createBudget", "createFixedExpense", "createSavingsGoal", "debt", "loanList", "challenge", "createDebtClerance", "createLoan", "createChallenge"].includes(screen)) content = <Planning key={screen} navigate={navigate} initialTab={["savings", "fixedExpenses", "createFixedExpense", "createSavingsGoal"].includes(screen) ? "fixed" : "budget"} initialForm={screen === "createBudget" ? "budget" : ["createFixedExpense", "createSavingsGoal"].includes(screen) ? "fixed" : ""} />;
  else if (tools.some((t) => t.path === screen)) content = <ToolPage key={screen} screen={screen} navigate={navigate} />;
  else if (tools.some((t) => t.create === screen)) content = <GoalForm key={screen} screen={screen} navigate={navigate} initialType={params.get("initialType") || undefined} />;
  else if (screen === "goalDetails") content = <GoalDetails id={params.get("id") || ""} navigate={navigate} />;
  else if (screen === "accountSettings") content = <AccountSettings key={params.get("option")} initialOption={params.get("option") || ""} navigate={navigate} />;
  else if (screen === "walletSettings") content = <Dashboard key={screen} walletSettingsMode navigate={navigate} />;
  else if (screen === "homepageConfiguration") content = <HomepageConfiguration navigate={navigate} />;
  else if (screen === "category" || screen === "categoryDetail") content = <Categories key={screen + params.get("name")} detail={screen === "categoryDetail"} name={params.get("name") || ""} wallet={params.get("wallet") || "default"} navigate={navigate} />;
  else if (["walletDetailsEdit", "createWallet1"].includes(screen)) content = <WalletScreen key={screen} screen={screen} walletId={params.get("wallet") || undefined} navigate={navigate} />;
  else if (screen === "addTransactionChatMode") content = <ChatPage navigate={navigate} />;
  else if (["addTransaction", "editTransaction"].includes(screen)) content = <TransactionForm key={screen} id={params.get("id") || ""} navigate={navigate} />;
  else if (screen === "recurringTransaction") content = <RecurringPage navigate={navigate} />;
  else if (screen === "milestones" || screen === "calendar") content = <CalendarPage milestones={screen === "milestones"} navigate={navigate} />;
  else if (screen === "featureRequest") content = <FeatureRequests navigate={navigate} />;
  else if (screen === "featureRequestCompleted") content = <CompletedRequests navigate={navigate} />;
  else if (screen === "paywall7dTrial") content = <PremiumPage navigate={navigate} />;
  else if (screen === "budgetAI" || screen === "budgetwithAIEntry") content = <BudgetAI navigate={navigate} />;
  else if (screen === "welcome") content = <WelcomeScreen onGetStarted={() => router.push("/onboarding")} onLogIn={() => router.push("/login")} />;
  else content = <div><PageHeader title="FinBridge" onBack={() => navigate("")} /><p>Không tìm thấy màn hình này.</p></div>;
  return <div className={"r-app " + theme + (((!screen && (tab === "home" || tab === "transactions" || tab === "tools" || tab === "settings")) || ["accountSettings", "homepageConfiguration", "walletSettings", "walletDetailsEdit", "createWallet1", "category", "categoryDetail", "budget", "savings", "fixedExpenses", "createBudget", "createFixedExpense", "createSavingsGoal", "debt", "loanList", "challenge", "createDebtClerance", "createLoan", "createChallenge"].includes(screen)) ? " fb-home-shell" : "")}>{content}{!screen && <nav className="r-bottom-nav" aria-label="Điều hướng chính">{[["home", "Trang chủ", "f015"], ["transactions", "Giao dịch", "f555"], ["tools", "Công cụ tiền tệ", "f51e"], ["settings", "Tài khoản", "f013"]].map(([id, name, code]) => <button key={id} type="button" className={tab === id ? "active" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => navigate(id === "home" ? "" : "?tab=" + id)}><Icon code={code} /><span>{name}</span></button>)}</nav>}</div>;
}
