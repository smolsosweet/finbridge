"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
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
    if (path === "support" || path === "terms" || path === "privacy") {
      router.push("/app?tab=settings");
      return;
    }
    router.push("/app" + (path ? (path.startsWith("?") ? "" : "/") + path : ""));
  };
  const theme = state.settings.theme === "system" ? "r-system-theme" : state.settings.theme === "dark" ? "r-dark" : "";

  const lang = /zh|chinese|trung|中文/.test(String(state.settings.language || "").toLowerCase())
    ? "zh"
    : /en|english|anh/.test(String(state.settings.language || "").toLowerCase())
    ? "en"
    : "vi";

  const navLabels = {
    vi: [["home", "Trang chủ", "f015"], ["transactions", "Giao dịch", "f555"], ["tools", "Kế hoạch", "f51e"], ["settings", "Cài đặt", "f013"]],
    en: [["home", "Home", "f015"], ["transactions", "Transactions", "f555"], ["tools", "Planning", "f51e"], ["settings", "Settings", "f013"]],
    zh: [["home", "首页", "f015"], ["transactions", "交易", "f555"], ["tools", "计划", "f51e"], ["settings", "设置", "f013"]],
  }[lang] as Array<[string, string, string]>;

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

  const isWelcome = screen === "welcome";
  const isAppShell = !isWelcome;

  return (
    <div className={"r-app " + theme + (isAppShell ? " fb-home-shell has-sidebar" : "")}>
      {!isWelcome && (
        <aside className="fb-desktop-sidebar" aria-label="Điều hướng máy tính">
          <div>
            <div className="fb-sidebar-brand" onClick={() => navigate("")} role="button" tabIndex={0}>
              <span className="fb-brand-mark" aria-hidden="true">
                <svg viewBox="0 0 32 32" fill="none">
                  <path d="M5 24V13M27 24V13M5 17C11 5 21 5 27 17M5 20H27M11 20V24M16 20V24M21 20V24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </span>
              <div className="fb-sidebar-brand-text">
                <span className="fb-sidebar-title">
                  <span className="fb-brand-fin">Fin</span>
                  <span className="fb-brand-bridge">Bridge</span>
                </span>
                <span className="fb-sidebar-badge">Web</span>
              </div>
            </div>

            <nav className="fb-sidebar-nav">
              {navLabels.map(([id, label, code]) => {
                const isActive =
                  (!screen && tab === id) ||
                  (id === "settings" && ["accountSettings", "featureRequest", "featureRequestCompleted"].includes(screen)) ||
                  (id === "tools" && ["budget", "savings", "fixedExpenses", "createBudget", "createFixedExpense"].includes(screen));
                return (
                  <button
                    key={id}
                    type="button"
                    className={"fb-sidebar-nav-item" + (isActive ? " active" : "")}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => navigate(id === "home" ? "" : "?tab=" + id)}
                  >
                    <Icon code={code} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="fb-sidebar-footer">
            <button
              type="button"
              className="fb-sidebar-profile"
              onClick={() => navigate("accountSettings")}
              title={lang === "vi" ? "Cài đặt tài khoản" : lang === "zh" ? "账户设置" : "Account settings"}
            >
              <div className="fb-sidebar-avatar">
                {state.settings.name && state.settings.name !== "." ? String(state.settings.name).charAt(0).toUpperCase() : "U"}
              </div>
              <div className="fb-sidebar-user-info">
                <span className="fb-sidebar-user-name">
                  {state.settings.name && state.settings.name !== "." ? String(state.settings.name) : "Người dùng"}
                </span>
                <span className="fb-sidebar-user-sub">
                  {lang === "vi" ? "Cài đặt tài khoản" : lang === "zh" ? "账户设置" : "Account settings"}
                </span>
              </div>
            </button>
          </div>
        </aside>
      )}

      <div className="fb-app-viewport">
        {content}
      </div>

      {!isWelcome && screen !== "addTransactionChatMode" && (
        <button
          type="button"
          className="r-fab fb-global-fab"
          aria-label={lang === "vi" ? "Thêm giao dịch qua chat AI" : lang === "zh" ? "AI 记账对话" : "Add transaction via AI chat"}
          title={lang === "vi" ? "Thêm giao dịch qua chat AI" : lang === "zh" ? "AI 记账对话" : "Add transaction via AI chat"}
          onClick={() => navigate("addTransactionChatMode")}
        >
          <Plus size={26} />
        </button>
      )}

      {!screen && (
        <nav className="r-bottom-nav" aria-label="Điều hướng chính">
          {navLabels.map(([id, name, code]) => (
            <button
              key={id}
              type="button"
              className={tab === id ? "active" : ""}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => navigate(id === "home" ? "" : "?tab=" + id)}
            >
              <Icon code={code} />
              <span>{name}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
