"use client";

import { useAppUiText } from "./useAppUiText";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
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
import { NotificationCenter } from "./NotificationCenter";
import { SafetyAlerts } from "@/components/safety/SafetyAlerts";
import { InternationalTransfers } from "@/components/transfers/InternationalTransfers";
import { FinBridgeMascot } from "@/components/FinBridgeMascot";
import "./workspace.css";

export function FinBridgeApp({ screen = "" }: { screen?: string }) {
  const uiText = useAppUiText();
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
  useEffect(() => { document.documentElement.lang = lang === "zh" ? "zh-CN" : lang; }, [lang]);

  const navLabels = {
    vi: [["home", "Trang chủ", "f015"], ["transactions", "Giao dịch", "f555"], ["tools", "Kế hoạch", "f51e"], ["settings", "Cài đặt", "f013"]],
    en: [["home", "Home", "f015"], ["transactions", "Transactions", "f555"], ["tools", "Planning", "f51e"], ["settings", "Settings", "f013"]],
    zh: [["home", "首页", "f015"], ["transactions", "交易", "f555"], ["tools", "计划", "f51e"], ["settings", "设置", "f013"]],
  }[lang] as Array<[string, string, string]>;

  navLabels.splice(3, 0, ["transfers", lang === "vi" ? "Chuyển tiền quốc tế" : lang === "zh" ? "国际汇款" : "International transfers", "f0ac"]);
  navLabels.splice(3, 0, ["safetyAlerts", lang === "vi" ? "Ngưỡng an toàn" : lang === "zh" ? "安全阈值" : "Safety thresholds", "f3ed"]);
  const mobileNavLabels = navLabels.filter(([id]) => id !== "safetyAlerts");
  const navigateToSection = (id: string) => navigate(id === "home" ? "" : id === "safetyAlerts" ? "safetyAlerts" : "?tab=" + id);
  let content;
  if (!screen) content = tab === "transfers" ? <InternationalTransfers navigate={navigate} /> : tab === "tools" ? <Planning key={params.get("plan") === "fixed" ? "planning-fixed" : "planning-budget"} navigate={navigate} initialTab={params.get("plan") === "fixed" ? "fixed" : "budget"} /> : tab === "settings" ? <SettingsOverview navigate={navigate} /> : tab === "transactions" ? <TransactionHistory navigate={navigate} /> : <Dashboard key={tab} navigate={navigate} />;
  else if (["budget", "savings", "fixedExpenses", "createBudget", "createFixedExpense", "createSavingsGoal", "debt", "loanList", "challenge", "createDebtClerance", "createLoan", "createChallenge"].includes(screen)) content = <Planning key={screen} navigate={navigate} initialTab={["savings", "fixedExpenses", "createFixedExpense", "createSavingsGoal"].includes(screen) ? "fixed" : "budget"} initialForm={screen === "createBudget" ? "budget" : ["createFixedExpense", "createSavingsGoal"].includes(screen) ? "fixed" : ""} />;
  else if (tools.some((t) => t.path === screen)) content = <ToolPage key={screen} screen={screen} navigate={navigate} />;
  else if (tools.some((t) => t.create === screen)) content = <GoalForm key={screen} screen={screen} navigate={navigate} initialType={params.get("initialType") || undefined} />;
  else if (screen === "goalDetails") content = <GoalDetails id={params.get("id") || ""} navigate={navigate} />;
  else if (screen === "safetyAlerts") content = <SafetyAlerts navigate={navigate} />;
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
  else content = <div><PageHeader title="FinBridge" onBack={() => navigate("")} /><p>{uiText("Không tìm thấy màn hình này.")}</p></div>;

  const isWelcome = screen === "welcome";
  const isAppShell = !isWelcome;
  const hasSharedHeader = !screen || ["budget", "savings", "fixedExpenses", "createBudget", "createFixedExpense", "createSavingsGoal", "createDebtClerance", "createLoan", "createChallenge", "debt", "loanList", "challenge", "accountSettings", "homepageConfiguration", "createWallet1"].includes(screen);

  return (
    <div className={"r-app " + theme + (isAppShell ? " fb-home-shell has-sidebar" : "")}>
      {!isWelcome && (
        <aside className="fb-desktop-sidebar" aria-label={uiText("Điều hướng máy tính")}>
          <div>
            <div className="fb-sidebar-brand" onClick={() => navigate("")} role="button" tabIndex={0}>
              <span className="fb-brand-mark" aria-hidden="true">
                <img
                  src="/mascots/finbridge-penguin-logo.webp"
                  alt="FinBridge"
                  width={32}
                  height={32}
                  className="fb-brand-logo-img"
                />
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
                  (id === "tools" && ["budget", "savings", "fixedExpenses", "createBudget", "createFixedExpense"].includes(screen)) ||
                  (id === "safetyAlerts" && screen === "safetyAlerts");
                return (
                  <button
                    key={id}
                    type="button"
                    className={"fb-sidebar-nav-item" + (isActive ? " active" : "")}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => navigateToSection(id)}
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

      {!isWelcome && !hasSharedHeader && screen !== "safetyAlerts" && <NotificationCenter navigate={navigate} floating />}

      {!isWelcome && screen !== "addTransactionChatMode" && (
        <div
          role="button"
          tabIndex={0}
          className="r-fab fb-global-fab fb-mascot-fab"
          aria-label={lang === "vi" ? "Trò chuyện cùng FinBridge AI" : lang === "zh" ? "与 FinBridge AI 对话" : "Chat with FinBridge AI"}
          title={lang === "vi" ? "Trò chuyện cùng FinBridge AI" : lang === "zh" ? "与 FinBridge AI 对话" : "Chat with FinBridge AI"}
          onClick={() => navigate("addTransactionChatMode")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              navigate("addTransactionChatMode");
            }
          }}
        >
          <div className="fb-mascot-fab-inner">
            <FinBridgeMascot
              size={44}
              label="Finn"
            />
            <span className="fb-mascot-fab-ai-badge">AI</span>
          </div>
        </div>
      )}

      {!screen && (
        <nav className="r-bottom-nav" aria-label={uiText("Điều hướng chính")}>
          {mobileNavLabels.map(([id, name, code]) => (
            <button
              key={id}
              type="button"
              className={tab === id ? "active" : ""}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => navigateToSection(id)}
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
