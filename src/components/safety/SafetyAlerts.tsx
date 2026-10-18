"use client";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Bell, Check, CheckCircle2, ChevronDown, CircleHelp, Database, Mail, PauseCircle, Plus, Search, ShieldCheck, Trash2, TrendingUp, Wallet, Zap } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { FinBridgeHeader } from "@/components/sites/rolly/replica/FinBridgeHeader";
import { CalendarLedgerModal } from "@/components/sites/rolly/replica/CalendarLedgerModal";
import { Modal, FinBridgeDropdown } from "@/components/sites/rolly/replica/Ui";
import { setSetting, useAppState } from "@/components/sites/rolly/replica/store";
import { evaluateSafety, safetyLanguage, safetyRuleSchema, safetySnapshot, type SafetyEvaluation, type SafetyRule } from "@/lib/safety-model";
import { useSafety } from "./SafetyProvider";
import { SAFETY_COPY } from "./safety-copy";
import styles from "./SafetyAlerts.module.css";

const EXTRA = {
  en: {
    forecastReached: "Forecast reaches threshold", belowReserve: "Below reserve", reserveSafe: "Reserve maintained", reached: "Spending threshold reached", balanceLabel: "Recorded balance", below: "is below the reserve floor", above: "meets the reserve floor", actualLabel: "Recorded spending", thresholdLabel: "Alert threshold", database: "Saved to your account", conditions: "Alert conditions", both: "Choose actual spending, forecast spending, or both. Each condition has its own threshold.", add: "Add threshold", remove: "Remove threshold", unit: "Threshold unit", scope: "Scope & period", channels: "Notification channels", configuration: "Alert configurations", conditionCount: "conditions", history: "Forecast starts after 3 elapsed days and at least one expense in this scope. Actual-spend alerts remain available.", missing: "This wallet or budget is no longer available. Choose another scope.", currency: "The budget currency differs from its wallet. Correct the budget in Planning.", transfer: "A cross-currency transfer is missing its destination amount, so this balance cannot be evaluated.", period: "This budget period has not started or its cycle is unsupported.", overflow: "Amounts exceed the safe calculation range.", chooseOne: "Choose at least one alert condition.", preview: "Preview for each condition", savedNote: "Values come from your database records. No live bank connection.", category: "Category", groupEmpty: "Create one configuration with all the thresholds you need.", actualDefault: "Actual 80% + 100%", forecastDefault: "Forecast 100%", budgetLimit: "Budget limit", select: "Select a budget or wallet first.", unavailableEmail: "Email is not enabled on this installation. In-app alerts are available.", sourceTime: "Data updated", actions: "Actions", details: "Details", close: "Close",
    kpiTotal: "Total rules", kpiTotalDesc: "Active configurations", kpiAlarm: "In alarm", kpiAlarmDesc: "Threshold reached", kpiOk: "OK", kpiOkDesc: "Within threshold", kpiPaused: "Paused", kpiPausedDesc: "Monitoring paused", percentUsed: "used", remaining: "Remaining", step1Desc: "Choose scope & name", step2Desc: "Set triggers & limits", step3Desc: "Notification channels", step4Desc: "Review and activate",
    typeFilter: "Type", typeAll: "All types", typeActual: "Actual spend", typeForecast: "Forecast", typeReserve: "Reserve floor", actualBadge: "Actual", forecastBadge: "Forecast", reserveBadge: "Reserve", actualSpendLabel: "Actual spend", forecastSpendLabel: "Forecast spend", pinActual: "Actual", pinForecast: "Forecast", pinReserve: "Reserve"
  },
  vi: {
    forecastReached: "Dự báo chạm ngưỡng", belowReserve: "Số dư dưới mức dự phòng", reserveSafe: "Đủ mức dự phòng", reached: "Chi tiêu đã chạm ngưỡng", balanceLabel: "Số dư đã ghi nhận", below: "thấp hơn mức dự phòng", above: "đạt mức dự phòng", actualLabel: "Chi tiêu đã ghi", thresholdLabel: "Ngưỡng cảnh báo", database: "Lưu trong tài khoản", conditions: "Điều kiện cảnh báo", both: "Chọn chi thực tế, dự báo hoặc cả hai. Mỗi điều kiện có ngưỡng riêng.", add: "Thêm ngưỡng", remove: "Bỏ ngưỡng", unit: "Đơn vị ngưỡng", scope: "Phạm vi & kỳ", channels: "Kênh thông báo", configuration: "Cấu hình cảnh báo", conditionCount: "điều kiện", history: "Dự báo bắt đầu khi kỳ đã qua ít nhất 3 ngày và có giao dịch chi trong phạm vi này. Cảnh báo chi thực tế vẫn hoạt động.", missing: "Ví hoặc ngân sách không còn phù hợp. Hãy chọn lại phạm vi.", currency: "Tiền tệ ngân sách không khớp ví. Hãy sửa ngân sách trong Kế hoạch.", transfer: "Giao dịch chuyển tiền khác tiền tệ thiếu số tiền nhận, nên chưa tính được số dư.", period: "Kỳ ngân sách chưa bắt đầu hoặc chu kỳ chưa được hỗ trợ.", overflow: "Số tiền vượt phạm vi tính toán an toàn.", chooseOne: "Hãy chọn ít nhất một điều kiện cảnh báo.", preview: "Xem trước từng điều kiện", savedNote: "Tính từ dữ liệu trong database, chưa phải số dư ngân hàng trực tiếp.", category: "Danh mục", groupEmpty: "Tạo một cấu hình gồm tất cả ngưỡng bạn cần.", actualDefault: "Thực tế 80% + 100%", forecastDefault: "Dự báo 100%", budgetLimit: "Hạn mức ngân sách", select: "Hãy chọn ngân sách hoặc ví trước.", unavailableEmail: "Bản cài đặt này chưa bật email. Bạn có thể nhận thông báo trong ứng dụng.", sourceTime: "Dữ liệu cập nhật", actions: "Thao tác", details: "Chi tiết", close: "Đóng",
    kpiTotal: "Tổng quy tắc", kpiTotalDesc: "Cấu hình theo dõi", kpiAlarm: "Cần chú ý", kpiAlarmDesc: "Đã chạm ngưỡng", kpiOk: "Bình thường", kpiOkDesc: "Trong giới hạn an toàn", kpiPaused: "Tạm dừng", kpiPausedDesc: "Tạm dừng theo dõi", percentUsed: "đã dùng", remaining: "Còn lại", step1Desc: "Chọn đối tượng & tên", step2Desc: "Đặt điều kiện & ngưỡng", step3Desc: "Kênh nhận thông báo", step4Desc: "Kiểm tra & kích hoạt",
    typeFilter: "Loại cảnh báo", typeAll: "Tất cả", typeActual: "Chi tiêu thực tế", typeForecast: "Dự báo chi tiêu", typeReserve: "Dự phòng ví", actualBadge: "Thực tế", forecastBadge: "Dự báo", reserveBadge: "Dự phòng", actualSpendLabel: "Chi tiêu thực tế", forecastSpendLabel: "Dự báo cuối kỳ", pinActual: "Thực tế", pinForecast: "Dự báo", pinReserve: "Sàn ví"
  },
  zh: {
    forecastReached: "预测将达到阈值", belowReserve: "余额低于备用金", reserveSafe: "备用金充足", reached: "支出已达阈值", balanceLabel: "已记录余额", below: "低于备用金下限", above: "达到备用金下限", actualLabel: "已记录支出", thresholdLabel: "提醒阈值", database: "存储于 PostgreSQL", conditions: "提醒条件", both: "可选择实际支出、预测支出或两者。每个条件有独立阈值。", add: "添加阈值", remove: "移除阈值", unit: "阈值单位", scope: "范围与周期", channels: "通知渠道", configuration: "提醒配置", conditionCount: "个条件", history: "周期至少经过3天且此范围有支出记录后才开始预测。实际支出提醒仍可使用。", missing: "钱包或预算不可用，请重新选择范围。", currency: "预算与钱包币种不同，请在计划中修改。", transfer: "跨币种转账缺少收款金额，无法评估余额。", period: "预算周期尚未开始或不受支持。", overflow: "金额超出安全计算范围。", chooseOne: "请至少选择一个提醒条件。", preview: "预览各条件", savedNote: "按数据库记录计算，并非银行实时余额。", category: "类别", groupEmpty: "在一个配置中添加所需的所有阈值。", actualDefault: "实际80%及100%", forecastDefault: "预测100%", budgetLimit: "预算限额", select: "请先选择预算或钱包。", unavailableEmail: "此环境未启用邮件，可使用应用内提醒。", sourceTime: "数据更新时间", actions: "操作", details: "详情", close: "关闭",
    kpiTotal: "全部规则", kpiTotalDesc: "监控配置", kpiAlarm: "需要关注", kpiAlarmDesc: "已达提醒阈值", kpiOk: "正常", kpiOkDesc: "未超限", kpiPaused: "已暂停", kpiPausedDesc: "已停止监控", percentUsed: "已使用", remaining: "剩余", step1Desc: "选择监控对象与名称", step2Desc: "设置触发条件与阈值", step3Desc: "通知渠道", step4Desc: "核对并启用规则",
    typeFilter: "提醒类型", typeAll: "全部", typeActual: "实际支出", typeForecast: "预测支出", typeReserve: "钱包备用金", actualBadge: "实际", forecastBadge: "预测", reserveBadge: "备用金", actualSpendLabel: "实际支出", forecastSpendLabel: "预测支出", pinActual: "实际", pinForecast: "预测", pinReserve: "底线"
  },
};

type Condition = Pick<SafetyRule, "id" | "basis" | "unit" | "threshold">;
type Draft = { originalIds: string[]; groupId: string; name: string; kind: SafetyRule["kind"]; targetId: string; email: boolean; active: boolean; conditions: Condition[] };
const condition = (basis: SafetyRule["basis"], threshold: number, unit: SafetyRule["unit"] = "percent"): Condition => ({ id: crypto.randomUUID(), basis, threshold, unit });
function toRules(draft: Draft): SafetyRule[] {
  return draft.conditions.map(c => ({ ...c, groupId: draft.groupId, name: draft.name.trim(), kind: draft.kind, targetId: draft.targetId, email: draft.email, active: draft.active, archived: false }));
}

export function SafetyAlerts({ navigate }: { navigate: (screen: string) => void }) {
  const state = useAppState(), lang = safetyLanguage(state.settings.language), t = SAFETY_COPY[lang], x = EXTRA[lang];
  const safety = useSafety(), params = useSearchParams();
  const [view, setView] = useState(["preferences", "history"].includes(params.get("view") || "") ? params.get("view")! : "rules");
  const [query, setQuery] = useState(params.get("query") || ""), [filter, setFilter] = useState("all"), [typeFilter, setTypeFilter] = useState<"all" | "actual" | "forecast" | "reserve">("all"), [draft, setDraft] = useState<Draft | null>(null), [step, setStep] = useState(0), [error, setError] = useState("");
  const [calendarLedgerOpen, setCalendarLedgerOpen] = useState(false);
  const [visibleRuleCount, setVisibleRuleCount] = useState(5);
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(5);
  const [detailsGroup, setDetailsGroup] = useState<{ id: string; rows: SafetyRule[] } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null), field = useId();
  const snapshot = useMemo(() => { try { return safetySnapshot(state, String(state.settings.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone)); } catch { return null; } }, [state]);
  useEffect(() => { heading.current?.focus(); }, [step, draft?.groupId]);
  useEffect(() => { setVisibleRuleCount(5); }, [query, filter, typeFilter]);
  if (!safety) return null;
  const { doc, loading, busy } = safety;
  const rules = doc.rules.filter(r => !r.archived);
  const groups = [...new Set(rules.map(r => r.groupId || r.id))].map(id => ({ id, rows: rules.filter(r => (r.groupId || r.id) === id) }));
  const wallets = snapshot?.wallets.filter(w => !w.archived) || [];
  const budgets = snapshot?.budgets.filter(b => wallets.some(w => w.id === b.wallet && w.currency === b.currency)) || [];
  const target = draft?.kind === "budget" ? budgets.find(b => b.id === draft.targetId) : wallets.find(w => w.id === draft?.targetId);
  const isEditing = !!draft && groups.some(g => g.id === draft.groupId || g.rows.some(r => draft.conditions.some(c => c.id === r.id)));
  const money = (n: number | null, currency: string) => n === null || !Number.isFinite(n) || !currency ? "—" : new Intl.NumberFormat(lang, { style: "currency", currency }).format(n);
  const time = (date: string | null) => {
    if (!date) return "—";
    try {
      const d = new Date(date);
      return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" }).format(d) : date;
    } catch {
      return date;
    }
  };
  const status = (rows: SafetyRule[]) => !rows.some(r => r.active) ? "paused" : rows.some(r => doc.evaluated[r.id]?.state === "alarm") ? "alarm" : rows.some(r => doc.evaluated[r.id]?.state === "ok") ? "ok" : "unavailable";
  const reason = (e: SafetyEvaluation) => x[e.reason as keyof typeof x] || t.reason;
  const conditionLabel = (r: SafetyRule) => `${r.kind === "reserve" ? t.reserve : t[r.basis]}: ${r.unit === "percent" ? r.threshold + "%" : money(r.threshold, doc.evaluated[r.id]?.currency || target?.currency || "")}`;

  function create() {
    setDraft({ originalIds: [], groupId: crypto.randomUUID(), name: "", kind: "budget", targetId: "", email: false, active: true, conditions: [condition("actual", 80), condition("actual", 100), condition("forecast", 100)] });
    setStep(0);
    setError("");
  }
  function edit(rows: SafetyRule[]) {
    const first = rows[0];
    setDraft({ originalIds: rows.map(r => r.id), groupId: first.groupId || crypto.randomUUID(), name: first.name, kind: first.kind, targetId: first.targetId, email: first.email, active: first.active, conditions: rows.map(({ id, basis, unit, threshold }) => ({ id, basis, unit, threshold })) });
    setStep(0);
    setError("");
  }
  function setBasis(basis: SafetyRule["basis"], enabled: boolean) {
    if (!draft) return;
    setDraft({ ...draft, conditions: enabled ? [...draft.conditions, condition(basis, basis === "actual" ? 80 : 100)] : draft.conditions.filter(c => c.basis !== basis) });
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!draft || busy) return;
    if (!target || !draft.name.trim()) { setError("INVALID_COMMAND"); return; }
    if (!draft.conditions.length) { setError("NO_CONDITION"); return; }
    if (!toRules(draft).every(r => safetyRuleSchema.safeParse(r).success)) { setError("INVALID_COMMAND"); return; }
    setError(""); if (step < 3) { setStep(s => s + 1); return; }
    try { await safety!.mutate({ action: "saveGroup", groupId: draft.groupId, replaceIds: draft.originalIds, rules: toRules(draft) }); setDraft(null); setView("rules"); }
    catch (e) { setError(e instanceof Error ? e.message : "UNAVAILABLE"); }
  }
  const preview = (r: SafetyRule) => snapshot ? evaluateSafety(r, snapshot) : null;
  const renderedPreview = (r: SafetyRule) => {
    const e = preview(r); if (!e) return <p>{x.select}</p>;
    const targetObj = draft?.kind === "budget" ? budgets.find(b => b.id === draft.targetId) : wallets.find(w => w.id === draft?.targetId);
    const budgetLimit = targetObj && "amount" in targetObj ? targetObj.amount : (e.limit || 1);
    const pct = e.limit > 0 ? Math.min(100, Math.round(((e.value || 0) / (r.unit === "percent" ? budgetLimit : e.limit)) * 100)) : 0;
    return (
      <section key={r.id} className={styles.conditionPreview}>
        <div className={styles.previewHeader}>
          <b>{t[r.basis]}</b>
          <span className={`${styles.badge} ${e.state === "unavailable" ? styles.neutral : styles[e.state]}`}>
            {e.state === "alarm" ? r.kind === "reserve" ? x.belowReserve : r.basis === "forecast" ? x.forecastReached : x.reached : t[e.state]}
          </span>
        </div>
        {e.state !== "unavailable" && (
          <div className={styles.previewMeterTrack}>
            <div
              className={`${styles.previewMeterFill} ${e.state === "alarm" ? styles.fillAlarm : pct >= 80 ? styles.fillWarning : styles.fillOk}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        <dl className={styles.metrics}>
          <div><dt>{r.kind === "reserve" ? t.value : r.basis === "forecast" ? t.forecast : t.actualSpent}</dt><dd>{money(e.value, e.currency)}</dd></div>
          <div><dt>{t.threshold}</dt><dd>{money(e.limit, e.currency)}</dd></div>
        </dl>
        {e.state === "unavailable" && <p className={styles.reason}><CircleHelp size={15} />{reason(e)}</p>}
        {r.basis === "forecast" && e.state !== "unavailable" && <p className={styles.forecastDisclaimer}>{t.forecastLimit}</p>}
      </section>
    );
  };

  const err = error || safety.error;
  const errorText = err === "NO_CONDITION" ? x.chooseOne : err === "WORKSPACE_CONFLICT" ? t.errors.CONFLICT : t.errors[err as keyof typeof t.errors] || t.errors.UNAVAILABLE;
  const shown = groups.filter(g => {
    const matchesQuery = g.rows[0].name.toLocaleLowerCase().includes(query.toLocaleLowerCase());
    const matchesStatus = filter === "all" || status(g.rows) === filter;
    const matchesType = typeFilter === "all"
      ? true
      : typeFilter === "actual"
        ? g.rows.some(r => r.kind === "budget" && r.basis === "actual")
        : typeFilter === "forecast"
          ? g.rows.some(r => r.kind === "budget" && r.basis === "forecast")
          : g.rows.some(r => r.kind === "reserve");
    return matchesQuery && matchesStatus && matchesType;
  });

  return (
    <main className={`r-dashboard fb-home ${styles.page}`} lang={lang}>
      <FinBridgeHeader
        lang={lang}
        navigate={navigate}
        eyebrow={lang === "vi" ? "AN TOÀN TÀI CHÍNH" : lang === "zh" ? "财务安全" : "FINANCIAL SAFETY"}
        title={t.title}
        subtitle={t.subtitle}
        theme={String(state.settings.theme)}
        currentLanguage={String(state.settings.language)}
        onOpenCalendar={() => setCalendarLedgerOpen(true)}
        onSelectLanguage={value => setSetting("language", value)}
        onToggleTheme={() => setSetting("theme", state.settings.theme === "dark" ? "light" : "dark")}
        primaryAction={!draft ? <button aria-label={t.create} className={`${styles.primary} fb-header-primary-action`} onClick={create} disabled={loading || busy}><Plus size={17}/><span>{t.create}</span></button> : undefined}
      />
      {draft && <div className={styles.topBackBar}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => {
            setDraft(null);
            setStep(0);
            setError("");
          }}
          aria-label={
            lang === "vi" ? "Quay lại Ngưỡng an toàn" : lang === "zh" ? "返回安全阈值" : "Back to Safety Thresholds"
          }
        >
          <ArrowLeft size={16} />
          <span>
            {lang === "vi" ? "Quay lại Ngưỡng an toàn" : lang === "zh" ? "返回安全阈值" : "Back to Safety Thresholds"}
          </span>
        </button>
      </div>}
      {err && (
        <div role="alert" className={styles.error}>
          {errorText}
          <button onClick={() => { setError(""); void safety.refresh().catch(() => setError("UNAVAILABLE")); }}>{t.retry}</button>
        </div>
      )}
      {loading ? (
        <p role="status">{t.loading}</p>
      ) : draft ? (
        <div className={styles.wizard}>
          <ol className={styles.steps}>
            {t.steps.map((label, i) => {
              const stepDescs = [x.step1Desc, x.step2Desc, x.step3Desc, x.step4Desc];
              return (
                <li key={label} aria-current={i === step ? "step" : undefined} className={i === step ? styles.currentStep : i < step ? styles.doneStep : ""}>
                  <span className={styles.stepNumber}>{i < step ? <Check size={16}/> : i + 1}</span>
                  <div className={styles.stepInfo}>
                    <small className={styles.stepIndex}>{i + 1} / 4</small>
                    <b className={styles.stepTitle}>{label}</b>
                    <span className={styles.stepSubtitle}>{stepDescs[i]}</span>
                  </div>
                </li>
              );
            })}
          </ol>
          <form className={styles.panel} onSubmit={submit}>
            <div>
              <small className={styles.stepLabel}>{step + 1} / 4 · {t.steps[step]}</small>
              <h2 ref={heading} tabIndex={-1}>{[t.scopeTitle, t.thresholdTitle, t.notificationsTitle, t.reviewTitle][step]}</h2>
            </div>
            {step === 0 && (
              <>
                <p className={styles.stepDesc}>{t.scopeHint}</p>
                <div className={styles.choices}>
                  {(["budget", "reserve"] as const).map(kind => (
                    <button
                      type="button"
                      key={kind}
                      className={`${styles.choiceBtn} ${draft.kind === kind ? styles.choiceActive : ""}`}
                      aria-pressed={draft.kind === kind}
                      onClick={() => setDraft({
                        ...draft,
                        kind,
                        targetId: "",
                        conditions: kind === "budget"
                          ? [condition("actual", 80), condition("actual", 100), condition("forecast", 100)]
                          : [condition("actual", 1, "amount")]
                      })}
                    >
                      <div className={styles.choiceIcon}>{kind === "budget" ? <Bell size={22}/> : <Wallet size={22}/>}</div>
                      <div className={styles.choiceBody}>
                        <b>{t[kind]}</b>
                        <small>{kind === "budget" ? t.budgetHint : t.reserveHint}</small>
                      </div>
                    </button>
                  ))}
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor={field + "target"}>{t.target}</label>
                  <select
                    id={field + "target"}
                    aria-label={t.target}
                    value={draft.targetId}
                    required
                    onChange={e => {
                      const item = draft.kind === "budget" ? budgets.find(b => b.id === e.target.value) : wallets.find(w => w.id === e.target.value);
                      setDraft({ ...draft, targetId: e.target.value, name: item ? "title" in item ? item.title : item.name : "" });
                    }}
                  >
                    <option value="">{t.choose}</option>
                    {draft.kind === "budget"
                      ? budgets.map(b => <option key={b.id} value={b.id}>{b.title} · {money(b.amount, b.currency)}</option>)
                      : wallets.map(w => <option key={w.id} value={w.id}>{w.name} · {w.currency}</option>)}
                  </select>
                </div>
                {draft.kind === "budget" && !budgets.length && (
                  <div className={styles.notice}>
                    <p>{t.noBudget}</p>
                    <button type="button" onClick={() => navigate("createBudget")}>{t.createBudget}<ArrowRight size={14}/></button>
                  </div>
                )}
                <div className={styles.formGroup}>
                  <label htmlFor={field + "name"}>{t.name}</label>
                  <input
                    id={field + "name"}
                    aria-label={t.name}
                    required
                    maxLength={100}
                    value={draft.name}
                    placeholder={draft.kind === "budget" ? "e.g. Dining Safety" : "e.g. Main Wallet Floor"}
                    onChange={e => setDraft({ ...draft, name: e.target.value })}
                  />
                </div>
                {target && "amount" in target && (
                  <div className={styles.scopeSummary}>
                    <div><small>{x.budgetLimit}</small><b>{money(target.amount, target.currency)}</b></div>
                    <div><small>{x.category}</small><b>{target.category || t.allCategories}</b></div>
                    <p><CircleHelp size={13} /> {t.inherited}</p>
                  </div>
                )}
              </>
            )}
            {step === 1 && (
              <>
                <p className={styles.stepDesc}>{draft.kind === "budget" ? x.both : t.reserveBasis}</p>
                {draft.kind === "budget" && (
                  <div className={styles.basisChoices}>
                    {(["actual", "forecast"] as const).map(basis => {
                      const isChecked = draft.conditions.some(c => c.basis === basis);
                      return (
                        <label key={basis} className={`${styles.basisCard} ${isChecked ? styles.basisCardActive : ""}`}>
                          <input type="checkbox" checked={isChecked} onChange={e => setBasis(basis, e.target.checked)}/>
                          <div>
                            <b>{t[basis]}</b>
                            <small>{basis === "actual" ? t.actualHint : t.forecastHint}</small>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
                <div className={styles.conditionRows}>
                  {draft.conditions.map((c, index) => (
                    <fieldset key={c.id} className={styles.conditionFieldset}>
                      <legend className={styles.conditionLegend}>{t[c.basis]} · {index + 1}</legend>
                      <div className={styles.conditionFields}>
                        <label htmlFor={field + c.id} className={styles.thresholdInputWrap}>
                          <span>{t.threshold}</span>
                          <input
                            id={field + c.id}
                            type="number"
                            min="0.001"
                            max={c.unit === "percent" ? 1000 : 1e12}
                            step="any"
                            required
                            value={c.threshold || ""}
                            onChange={e => setDraft({ ...draft, conditions: draft.conditions.map(row => row.id === c.id ? { ...row, threshold: e.target.valueAsNumber } : row) })}
                          />
                        </label>
                        <label htmlFor={field + c.id + "unit"} className={styles.unitSelectWrap}>
                          <span>{x.unit}</span>
                          <select
                            id={field + c.id + "unit"}
                            value={c.unit}
                            disabled={draft.kind === "reserve"}
                            onChange={e => setDraft({ ...draft, conditions: draft.conditions.map(row => row.id === c.id ? { ...row, unit: e.target.value as SafetyRule["unit"] } : row) })}
                          >
                            <option value="amount">{t.amount} · {target?.currency}</option>
                            {draft.kind === "budget" && <option value="percent">{t.percent}</option>}
                          </select>
                        </label>
                        {draft.kind === "budget" && (
                          <button
                            className={styles.removeCondition}
                            type="button"
                            aria-label={x.remove + " " + (index + 1)}
                            onClick={() => setDraft({ ...draft, conditions: draft.conditions.filter(row => row.id !== c.id) })}
                          >
                            <Trash2 size={16}/>
                          </button>
                        )}
                      </div>
                    </fieldset>
                  ))}
                </div>
                {draft.kind === "budget" && draft.conditions.length < 10 && (
                  <div className={styles.presets}>
                    {(["actual", "forecast"] as const).filter(basis => draft.conditions.some(c => c.basis === basis)).map(basis => (
                      <button
                        type="button"
                        key={basis}
                        className={styles.addPresetBtn}
                        onClick={() => setDraft({ ...draft, conditions: [...draft.conditions, condition(basis, 100)] })}
                      >
                        <Plus size={14}/>{x.add} · {t[basis]}
                      </button>
                    ))}
                  </div>
                )}
                {!draft.conditions.length && <p className={styles.notice}>{x.chooseOne}</p>}
                <div className={styles.previewSection}>
                  <h3>{x.preview}</h3>
                  <div className={styles.previewGrid}>{toRules(draft).map(renderedPreview)}</div>
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <div className={`${styles.channel} ${styles.channelActive}`}>
                  <div className={styles.channelIcon}><Bell size={22}/></div>
                  <div className={styles.channelText}>
                    <b>{t.inApp}</b>
                    <p>{t.inAppHint}</p>
                  </div>
                  <span className={styles.channelStatus}><Check size={18}/></span>
                </div>
                <label className={`${styles.channel} ${!doc.emailAvailable ? styles.channelDisabled : ""}`}>
                  <span className={styles.channelIcon}><Mail size={22}/></span>
                  <span className={styles.channelText}>
                    <b>{t.email}</b>
                    <small>{t.emailHint}</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={draft.email}
                    disabled={!doc.emailAvailable}
                    onChange={e => setDraft({ ...draft, email: e.target.checked })}
                  />
                </label>
                {!doc.emailAvailable && <p className={styles.notice}>{x.unavailableEmail}</p>}
                <p className={styles.notice}>{t.frequency}</p>
              </>
            )}
            {step === 3 && (
              <>
                <p className={styles.stepDesc}>{t.reviewHint}</p>
                <dl className={styles.review}>
                  <div><dt>{t.name}</dt><dd><b>{draft.name}</b></dd></div>
                  <div>
                    <dt>{x.scope}</dt>
                    <dd>
                      {target && ("title" in target ? target.title : target.name)} · {target?.currency}
                      {draft.kind === "budget" && preview(toRules(draft)[0]) && (
                        <small>{preview(toRules(draft)[0])!.start} — {preview(toRules(draft)[0])!.end} · {snapshot?.timeZone}</small>
                      )}
                    </dd>
                  </div>
                  <div><dt>{x.channels}</dt><dd>{t.inApp}{draft.email ? " + " + t.email : ""}</dd></div>
                </dl>
                <h3>{x.conditions} ({draft.conditions.length})</h3>
                <div className={styles.previewGrid}>{toRules(draft).map(renderedPreview)}</div>
                <p className={styles.notice}><Database size={15}/> {x.savedNote}</p>
              </>
            )}
            <footer className={styles.wizardFooter}>
              <button
                className={styles.secondary}
                type="button"
                disabled={busy}
                onClick={() => { setError(""); if (step) setStep(s => s - 1); else setDraft(null); }}
              >
                <ArrowLeft size={15}/>{step ? t.back : t.cancel}
              </button>
              <button
                className={styles.primary}
                type="submit"
                disabled={busy || (step === 0 && !target) || (step === 1 && !draft.conditions.length)}
              >
                {busy ? t.saving : step === 3 ? isEditing ? t.update : t.save : t.next}
                <ArrowRight size={15}/>
              </button>
            </footer>
          </form>
        </div>
      ) : (
        <>
          {/* AWS CloudWatch / Budgets Style KPI Overview Cards */}
          <div className={styles.awsSummaryGrid}>
            <button type="button" className={styles.awsKpiCard} aria-pressed={view === "rules" && filter === "all"} onClick={() => { setView("rules"); setFilter("all"); setTypeFilter("all"); }}>
              <div className={styles.kpiIconWrap}><Bell size={20} /></div>
              <div className={styles.kpiContent}>
                <span className={styles.kpiLabel}>{x.kpiTotal}</span>
                <b className={styles.kpiValue}>{groups.length}</b>
                <small className={styles.kpiDesc}>{x.kpiTotalDesc}</small>
              </div>
            </button>
            <button type="button" className={`${styles.awsKpiCard} ${groups.filter(g => status(g.rows) === "alarm").length > 0 ? styles.kpiAlarmActive : ""}`} aria-pressed={view === "rules" && filter === "alarm"} onClick={() => { setView("rules"); setFilter("alarm"); setTypeFilter("all"); }}>
              <div className={`${styles.kpiIconWrap} ${styles.kpiAlarmIcon}`}><AlertTriangle size={20} /></div>
              <div className={styles.kpiContent}>
                <span className={styles.kpiLabel}>{x.kpiAlarm}</span>
                <b className={styles.kpiValue}>{groups.filter(g => status(g.rows) === "alarm").length}</b>
                <small className={styles.kpiDesc}>{x.kpiAlarmDesc}</small>
              </div>
            </button>
            <button type="button" className={styles.awsKpiCard} aria-pressed={view === "rules" && filter === "ok"} onClick={() => { setView("rules"); setFilter("ok"); setTypeFilter("all"); }}>
              <div className={`${styles.kpiIconWrap} ${styles.kpiOkIcon}`}><CheckCircle2 size={20} /></div>
              <div className={styles.kpiContent}>
                <span className={styles.kpiLabel}>{x.kpiOk}</span>
                <b className={styles.kpiValue}>{groups.filter(g => status(g.rows) === "ok").length}</b>
                <small className={styles.kpiDesc}>{x.kpiOkDesc}</small>
              </div>
            </button>
            <button type="button" className={styles.awsKpiCard} aria-pressed={view === "rules" && filter === "paused"} onClick={() => { setView("rules"); setFilter("paused"); setTypeFilter("all"); }}>
              <div className={`${styles.kpiIconWrap} ${styles.kpiPausedIcon}`}><PauseCircle size={20} /></div>
              <div className={styles.kpiContent}>
                <span className={styles.kpiLabel}>{x.kpiPaused}</span>
                <b className={styles.kpiValue}>{groups.filter(g => status(g.rows) === "paused").length}</b>
                <small className={styles.kpiDesc}>{x.kpiPausedDesc}</small>
              </div>
            </button>
          </div>

          <div className={styles.tabs} role="tablist">
            {(["rules", "history", "preferences"] as const).map(v => (
              <button role="tab" aria-selected={view === v} key={v} onClick={() => setView(v)}>
                {t[v]}
              </button>
            ))}
          </div>

          {view === "rules" && (
            <>
              {/* AWS Budgets Style Segmented Type Navigation Pills */}
              <div className={styles.typePillRow} role="group" aria-label={x.typeFilter}>
                <button
                  type="button"
                  className={`${styles.typePill} ${typeFilter === "all" ? styles.typePillActive : ""}`}
                  onClick={() => setTypeFilter("all")}
                >
                  <span>{x.typeAll}</span>
                  <span className={styles.typePillCount}>{groups.length}</span>
                </button>
                <button
                  type="button"
                  className={`${styles.typePill} ${typeFilter === "actual" ? styles.typePillActive : ""}`}
                  onClick={() => setTypeFilter("actual")}
                >
                  <Zap size={13} />
                  <span>{x.typeActual}</span>
                  <span className={styles.typePillCount}>
                    {groups.filter(g => g.rows.some(r => r.kind === "budget" && r.basis === "actual")).length}
                  </span>
                </button>
                <button
                  type="button"
                  className={`${styles.typePill} ${typeFilter === "forecast" ? styles.typePillActive : ""}`}
                  onClick={() => setTypeFilter("forecast")}
                >
                  <TrendingUp size={13} />
                  <span>{x.typeForecast}</span>
                  <span className={styles.typePillCount}>
                    {groups.filter(g => g.rows.some(r => r.kind === "budget" && r.basis === "forecast")).length}
                  </span>
                </button>
                <button
                  type="button"
                  className={`${styles.typePill} ${typeFilter === "reserve" ? styles.typePillActive : ""}`}
                  onClick={() => setTypeFilter("reserve")}
                >
                  <Wallet size={13} />
                  <span>{x.typeReserve}</span>
                  <span className={styles.typePillCount}>
                    {groups.filter(g => g.rows.some(r => r.kind === "reserve")).length}
                  </span>
                </button>
              </div>

              <div className={styles.filters}>
                <label>
                  <Search size={17}/>
                  <input aria-label={t.search} placeholder={t.search} value={query} onChange={e => setQuery(e.target.value)}/>
                </label>
                <FinBridgeDropdown
                  value={filter}
                  onChange={setFilter}
                  ariaLabel={t.all}
                  options={(["all", "ok", "alarm", "paused", "unavailable"] as const).map(s => ({
                    value: s,
                    label: t[s],
                  }))}
                />
              </div>

              {!groups.length ? (
                <div className={styles.empty}>
                  <ShieldCheck size={42}/>
                  <h2>{t.empty}</h2>
                  <p>{x.groupEmpty}</p>
                  <button className={styles.primary} onClick={create}><Plus size={17}/>{t.create}</button>
                </div>
              ) : !shown.length ? (
                <p>{t.noResults}</p>
              ) : (
                <>
                  <div className={styles.configurationList}>
                    {shown.slice(0, visibleRuleCount).map(group => {
                    const r = group.rows[0], s = status(group.rows);
                    const targetObj = r.kind === "budget"
                      ? budgets.find(b => b.id === r.targetId)
                      : wallets.find(w => w.id === r.targetId);

                    const actualRow = group.rows.find(row => row.basis === "actual");
                    const forecastRow = group.rows.find(row => row.basis === "forecast");
                    const reserveRow = group.rows.find(row => row.kind === "reserve");

                    const actualEval = actualRow ? doc.evaluated[actualRow.id] : null;
                    const forecastEval = forecastRow ? doc.evaluated[forecastRow.id] : null;
                    const reserveEval = reserveRow ? doc.evaluated[reserveRow.id] : null;

                    const primaryEval = actualEval || reserveEval || forecastEval || doc.evaluated[r.id];
                    const budgetLimit = targetObj && "amount" in targetObj ? targetObj.amount : (primaryEval?.limit || 0);

                    const currentActual = r.kind === "reserve"
                      ? (reserveEval?.value ?? 0)
                      : (actualEval?.value ?? (primaryEval?.actual ?? primaryEval?.value ?? 0));

                    const percentActual = budgetLimit > 0 ? Math.min(100, Math.round((currentActual / budgetLimit) * 100)) : 0;
                    const remainingAmt = budgetLimit > 0 ? Math.max(0, budgetLimit - currentActual) : null;

                    const forecastVal = forecastEval?.value;
                    const percentForecast = (budgetLimit > 0 && typeof forecastVal === "number" && forecastVal > 0)
                      ? Math.min(100, Math.round((forecastVal / budgetLimit) * 100))
                      : 0;

                    return (
                      <article key={group.id} className={styles.configuration}>
                        <header>
                          <div>
                            <h2>{r.name}</h2>
                            <div className={styles.scopeTypeRow}>
                              <p>{t[r.kind]} · {doc.evaluated[r.id]?.currency || targetObj?.currency}</p>
                              <div className={styles.cardTypeBadges}>
                                {actualRow && <span className={styles.typeBadgeActual}><Zap size={10}/> {x.actualBadge}</span>}
                                {forecastRow && <span className={styles.typeBadgeForecast}><TrendingUp size={10}/> {x.forecastBadge}</span>}
                                {reserveRow && <span className={styles.typeBadgeReserve}><Wallet size={10}/> {x.reserveBadge}</span>}
                              </div>
                            </div>
                          </div>
                          <span className={`${styles.badge} ${styles[s]}`}>
                            {r.kind === "reserve"
                              ? s === "alarm" ? x.belowReserve : s === "ok" ? x.reserveSafe : t[s]
                              : s === "alarm"
                                ? group.rows.some(row => row.basis === "actual" && doc.evaluated[row.id]?.state === "alarm")
                                  ? x.reached
                                  : x.forecastReached
                                : t[s]}
                          </span>
                        </header>

                        <div className={styles.compactInfoRow}>
                          <div className={styles.compactInfoLeft}>
                            <span>{r.kind === "reserve" ? x.balanceLabel : x.actualSpendLabel}:</span>
                            <b>{money(currentActual, primaryEval?.currency || targetObj?.currency || "")}</b>
                            {r.kind === "budget" && budgetLimit > 0 && (
                              <small className={styles.compactLimitSub}>/ {money(budgetLimit, primaryEval?.currency || targetObj?.currency || "")} ({percentActual}%)</small>
                            )}
                          </div>
                          <div className={styles.compactInfoRight}>
                            <span>
                              {x.thresholdLabel}: <b>{group.rows.map(row => `${row.unit === "percent" ? `${row.threshold}%` : money(row.threshold, primaryEval?.currency || targetObj?.currency || "")}`).join(", ")}</b>
                            </span>
                            {remainingAmt !== null && (
                              <span>· {x.remaining}: <b>{money(remainingAmt, primaryEval?.currency || targetObj?.currency || "")}</b></span>
                            )}
                          </div>
                        </div>

                        <div className={styles.compactCardActions}>
                          <span className={styles.compactChannel}>
                            <Bell size={13} />
                            <span>{r.email ? t.inApp + " + " + t.email : t.inApp}</span>
                          </span>
                          <div className={styles.compactActionBtns}>
                            <button
                              type="button"
                              className={styles.btnDetail}
                              onClick={() => setDetailsGroup(group)}
                            >
                              {x.details}
                            </button>
                            <button
                              type="button"
                              className={styles.btnEdit}
                              disabled={busy}
                              onClick={() => edit(group.rows)}
                            >
                              {t.edit}
                            </button>
                            <button
                              type="button"
                              className={styles.btnToggle}
                              disabled={busy}
                              onClick={async () => {
                                try {
                                  if (r.groupId) await safety.mutate({ action: "saveGroup", groupId: r.groupId, rules: group.rows.map(row => ({ ...row, active: !r.active })) });
                                  else await safety.mutate({ action: "save", rule: { ...r, active: !r.active } });
                                } catch { /* Retryable */ }
                              }}
                            >
                              {r.active ? t.pause : t.resume}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                  </div>

                  {detailsGroup && (() => {
                    const activeGroup = groups.find(g => g.id === detailsGroup.id) || detailsGroup;
                    const r = activeGroup.rows[0], s = status(activeGroup.rows);
                    const targetObj = r.kind === "budget"
                      ? budgets.find(b => b.id === r.targetId)
                      : wallets.find(w => w.id === r.targetId);

                    const actualRow = activeGroup.rows.find(row => row.basis === "actual");
                    const forecastRow = activeGroup.rows.find(row => row.basis === "forecast");
                    const reserveRow = activeGroup.rows.find(row => row.kind === "reserve");

                    const actualEval = actualRow ? doc.evaluated[actualRow.id] : null;
                    const forecastEval = forecastRow ? doc.evaluated[forecastRow.id] : null;
                    const reserveEval = reserveRow ? doc.evaluated[reserveRow.id] : null;

                    const primaryEval = actualEval || reserveEval || forecastEval || doc.evaluated[r.id];
                    const budgetLimit = targetObj && "amount" in targetObj ? targetObj.amount : (primaryEval?.limit || 0);

                    const currentActual = r.kind === "reserve"
                      ? (reserveEval?.value ?? 0)
                      : (actualEval?.value ?? (primaryEval?.actual ?? primaryEval?.value ?? 0));

                    const percentActual = budgetLimit > 0 ? Math.min(100, Math.round((currentActual / budgetLimit) * 100)) : 0;
                    const remainingAmt = budgetLimit > 0 ? Math.max(0, budgetLimit - currentActual) : null;

                    const forecastVal = forecastEval?.value;
                    const percentForecast = (budgetLimit > 0 && typeof forecastVal === "number" && forecastVal > 0)
                      ? Math.min(100, Math.round((forecastVal / budgetLimit) * 100))
                      : 0;

                    return (
                      <Modal wide title={`${r.name} · ${x.details}`} onClose={() => setDetailsGroup(null)}>
                        <div className={styles.detailsModalContent}>
                          <div className={styles.detailsModalHeader}>
                            <div className={styles.scopeTypeRow}>
                              <p>{t[r.kind]} · {doc.evaluated[r.id]?.currency || targetObj?.currency}</p>
                              <div className={styles.cardTypeBadges}>
                                {actualRow && <span className={styles.typeBadgeActual}><Zap size={10}/> {x.actualBadge}</span>}
                                {forecastRow && <span className={styles.typeBadgeForecast}><TrendingUp size={10}/> {x.forecastBadge}</span>}
                                {reserveRow && <span className={styles.typeBadgeReserve}><Wallet size={10}/> {x.reserveBadge}</span>}
                              </div>
                            </div>
                            <span className={`${styles.badge} ${styles[s]}`}>
                              {r.kind === "reserve"
                                ? s === "alarm" ? x.belowReserve : s === "ok" ? x.reserveSafe : t[s]
                                : s === "alarm"
                                  ? activeGroup.rows.some(row => row.basis === "actual" && doc.evaluated[row.id]?.state === "alarm")
                                    ? x.reached
                                    : x.forecastReached
                                  : t[s]}
                            </span>
                          </div>

                          {/* Section 1: AWS Budgets Style Visual Progress Meter */}
                          {primaryEval && primaryEval.state !== "unavailable" && (
                            <div className={styles.awsMeterSection}>
                              <div className={styles.meterSectionHeader}>
                                <span className={styles.meterSectionTitle}>
                                  {lang === "vi" ? "Tiến độ & Mức chi thực tế" : lang === "zh" ? "进度与实际支出" : "Progress & Actual Spending"}
                                </span>
                              </div>
                              <div className={styles.awsMeterHeader}>
                                <div className={styles.awsMeterCol}>
                                  <small className={styles.awsMeterLabel}>
                                    {r.kind === "reserve" ? x.balanceLabel : x.actualSpendLabel}
                                  </small>
                                  <span className={styles.awsMeterSpend}>
                                    <b>{money(currentActual, primaryEval.currency)}</b>
                                    {budgetLimit > 0 && <small> / {money(budgetLimit, primaryEval.currency)}</small>}
                                    {budgetLimit > 0 && <span className={styles.awsMeterPctTag}>({percentActual}%)</span>}
                                  </span>
                                </div>

                                {forecastRow && (
                                  <div className={styles.awsMeterColRight}>
                                    <small className={styles.awsMeterLabel}>{x.forecastSpendLabel}</small>
                                    <span className={styles.awsMeterForecastVal}>
                                      {forecastEval && forecastEval.state !== "unavailable" && typeof forecastVal === "number" ? (
                                        <>
                                          <b>{money(forecastVal, primaryEval.currency)}</b>
                                          <span className={styles.awsMeterForecastPct}>({percentForecast}%)</span>
                                        </>
                                      ) : (
                                        <small className={styles.forecastPendingText}>
                                          {forecastEval?.state === "unavailable" ? reason(forecastEval) : "—"}
                                        </small>
                                      )}
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div
                                className={styles.awsMeterTrack}
                                role="progressbar"
                                aria-valuenow={percentActual}
                                aria-valuemin={0}
                                aria-valuemax={100}
                              >
                                {percentForecast > percentActual && (
                                  <div
                                    className={styles.awsForecastBar}
                                    style={{ width: `${percentForecast}%` }}
                                    title={`${x.forecastSpendLabel}: ${money(forecastVal ?? null, primaryEval.currency)} (${percentForecast}%)`}
                                  />
                                )}
                                <div
                                  className={`${styles.awsMeterFill} ${s === "alarm" ? styles.fillAlarm : percentActual >= 80 ? styles.fillWarning : styles.fillOk}`}
                                  style={{ width: `${percentActual}%` }}
                                />
                                {(() => {
                                  const map = new Map<number, { isForecast: boolean; isReserve: boolean; text: string }[]>();
                                  for (const row of activeGroup.rows) {
                                    const isPercent = row.unit === "percent";
                                    const pct = isPercent ? row.threshold : budgetLimit > 0 ? (row.threshold / budgetLimit) * 100 : null;
                                    if (pct === null) continue;
                                    const rounded = Math.min(100, Math.max(0, Math.round(pct)));
                                    if (!map.has(rounded)) map.set(rounded, []);
                                    const isForecast = row.basis === "forecast";
                                    const isReserve = row.kind === "reserve";
                                    const pinText = isForecast ? `${x.pinForecast} ${row.threshold}%` : isReserve ? `${x.pinReserve}` : `${x.pinActual} ${isPercent ? row.threshold + "%" : money(row.threshold, primaryEval.currency)}`;
                                    const icon = isForecast ? "📈 " : isReserve ? "🛡️ " : "⚡ ";
                                    map.get(rounded)!.push({ isForecast, isReserve, text: `${icon}${pinText}` });
                                  }
                                  return Array.from(map.entries()).map(([pct, items]) => {
                                    const hasForecast = items.some(i => i.isForecast);
                                    const alignStyle = pct >= 92 ? { left: `${pct}%`, transform: "translateX(-85%)" } : pct <= 8 ? { left: `${pct}%`, transform: "translateX(-15%)" } : { left: `${pct}%` };
                                    return (
                                      <div
                                        key={pct}
                                        className={`${styles.awsThresholdMarker} ${hasForecast ? styles.markerForecast : styles.markerActual}`}
                                        style={alignStyle}
                                        title={items.map(i => i.text).join(" · ")}
                                      >
                                        <span className={`${styles.awsThresholdPin} ${hasForecast ? styles.pinForecast : styles.pinActual}`} />
                                        <span className={`${styles.awsThresholdPinLabel} ${hasForecast ? styles.labelForecast : styles.labelActual}`}>
                                          {items.map(i => i.text).join(" ")}
                                        </span>
                                      </div>
                                    );
                                  });
                                })()}
                              </div>

                              <div className={styles.awsMeterFooter}>
                                <span className={styles.awsMeterFooterThresholds}>
                                  {x.thresholdLabel}:{" "}
                                  {activeGroup.rows.map(row => `${row.basis === "forecast" ? x.pinForecast : row.kind === "reserve" ? x.pinReserve : x.pinActual} ${row.unit === "percent" ? `${row.threshold}%` : money(row.threshold, primaryEval.currency)}`).join(", ")}
                                </span>
                                {remainingAmt !== null && (
                                  <span>{x.remaining}: <b>{money(remainingAmt, primaryEval.currency)}</b></span>
                                )}
                              </div>
                            </div>
                          )}

                          <div className={styles.conditionTags}>
                            {activeGroup.rows.map(row => {
                              const isForecast = row.basis === "forecast";
                              const isReserve = row.kind === "reserve";
                              return (
                                <span
                                  key={row.id}
                                  className={`${styles.conditionTag} ${isReserve ? styles.tagReserve : isForecast ? styles.tagForecast : styles.tagActual}`}
                                >
                                  {isReserve ? <Wallet size={12} /> : isForecast ? <TrendingUp size={12} /> : <Zap size={12} />}
                                  <span>{conditionLabel(row)}</span>
                                </span>
                              );
                            })}
                          </div>

                          {activeGroup.rows.some(row => doc.evaluated[row.id]?.state === "unavailable") && (
                            <div className={styles.unavailableWarning}>
                              {activeGroup.rows.filter(row => doc.evaluated[row.id]?.state === "unavailable").map(row => (
                                <p key={row.id} className={styles.configReason}>
                                  <CircleHelp size={14} />
                                  <span>{conditionLabel(row)}: {reason(doc.evaluated[row.id]!)}</span>
                                </p>
                              ))}
                            </div>
                          )}

                          {/* Section 2: Condition Details */}
                          <div className={styles.modalConditionsSection}>
                            <div className={styles.modalConditionsHeader}>
                              <h4>{lang === "vi" ? "Chi tiết từng điều kiện cảnh báo" : lang === "zh" ? "警报条件详情" : "Alert condition details"}</h4>
                              <span className={styles.modalConditionsCount}>
                                {activeGroup.rows.length} {lang === "vi" ? "điều kiện" : lang === "zh" ? "项条件" : "conditions"}
                              </span>
                            </div>
                            <div className={styles.configurationValues}>
                              {activeGroup.rows.map(row => {
                                const e = doc.evaluated[row.id];
                                return (
                                  <div key={row.id} className={`${styles.configValueCard} ${row.basis === "forecast" ? styles.configValueForecast : row.kind === "reserve" ? styles.configValueReserve : styles.configValueActual}`}>
                                    <div className={styles.configValueTop}>
                                      <small className={styles.configBasis}>
                                        {row.kind === "reserve" ? <Wallet size={12}/> : row.basis === "forecast" ? <TrendingUp size={12}/> : <Zap size={12}/>}
                                        <span>{conditionLabel(row)}</span>
                                      </small>
                                      <span className={`${styles.configBadgeMini} ${e?.state === "alarm" ? styles.alarm : e?.state === "ok" ? styles.ok : styles.neutral}`}>
                                        {e?.state ? t[e.state] : "—"}
                                      </span>
                                    </div>
                                    <div className={styles.configCardDivider} />
                                    <div className={styles.configCardBody}>
                                      <div className={styles.configAmountRow}>
                                        <small className={styles.configLabel}>{row.kind === "reserve" ? x.balanceLabel : row.basis === "forecast" ? t.forecast : x.actualLabel}</small>
                                        <b className={styles.configAmount}>{e ? money(e.value, e.currency) : "—"}</b>
                                      </div>
                                      {e && e.state !== "unavailable" && (
                                        <p className={styles.configThreshold}>{x.thresholdLabel}: <b>{money(e.limit, e.currency)}</b></p>
                                      )}
                                      {e?.state === "unavailable" && <p className={styles.configReason}>{reason(e)}</p>}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Section 3: Footer Actions */}
                          <div className={styles.detailsModalActions}>
                            <span className={styles.channelBadge}>
                              <Bell size={13} />
                              {r.email ? t.inApp + " + " + t.email : t.inApp}
                            </span>
                            <div className={styles.modalActionButtons}>
                              <button
                                type="button"
                                className={styles.btnClose}
                                onClick={() => setDetailsGroup(null)}
                              >
                                {x.close}
                              </button>
                              <button
                                type="button"
                                className={styles.btnToggle}
                                disabled={busy}
                                onClick={async () => {
                                  try {
                                    if (r.groupId) await safety.mutate({ action: "saveGroup", groupId: r.groupId, rules: activeGroup.rows.map(row => ({ ...row, active: !r.active })) });
                                    else await safety.mutate({ action: "save", rule: { ...r, active: !r.active } });
                                  } catch { /* Retryable */ }
                                }}
                              >
                                {r.active ? t.pause : t.resume}
                              </button>
                              <button
                                type="button"
                                className={styles.btnEdit}
                                disabled={busy}
                                onClick={() => { setDetailsGroup(null); edit(activeGroup.rows); }}
                              >
                                {t.edit}
                              </button>
                            </div>
                          </div>
                        </div>
                      </Modal>
                    );
                  })()}
                  {shown.length > visibleRuleCount && (
                    <div className={styles.loadMoreWrap}>
                      <button
                        type="button"
                        className={styles.loadMoreBtn}
                        onClick={() => setVisibleRuleCount(prev => prev + 5)}
                      >
                        <span>
                          {lang === "vi"
                            ? `Xem thêm quy tắc (${shown.length - visibleRuleCount} còn lại)`
                            : lang === "zh"
                              ? `查看更多规则 (还剩 ${shown.length - visibleRuleCount} 条)`
                              : `Load more rules (${shown.length - visibleRuleCount} remaining)`}
                        </span>
                        <ChevronDown size={15} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {view === "history" && (
            <section className={styles.history}>
              <div className={styles.historyHeader}>
                <p>{t.historyNote}</p>
                <button disabled={busy || !doc.events.some(e => !e.read)} onClick={() => void safety.mutate({ action: "read" }).catch(() => {})}>
                  {t.markRead}
                </button>
              </div>
              {!doc.events.length ? (
                <div className={styles.empty}>
                  <Bell size={35}/>
                  <h2>{t.emptyHistory}</h2>
                </div>
              ) : (
                <>
                  {doc.events.slice(0, visibleHistoryCount).map(event => (
                    <article key={event.id} className={!event.read ? styles.unread : ""}>
                      <div>
                        <h2>{event.name}</h2>
                        <p>{time(event.createdAt)}</p>
                      </div>
                      <dl className={styles.metrics}>
                        <div><dt>{t.value}</dt><dd>{money(event.evaluation.value, event.evaluation.currency)}</dd></div>
                        <div><dt>{t.threshold}</dt><dd>{money(event.evaluation.limit, event.evaluation.currency)}</dd></div>
                      </dl>
                      <span className={styles.badge}>{t[event.emailStatus]}</span>
                    </article>
                  ))}
                  {doc.events.length > visibleHistoryCount && (
                    <div className={styles.loadMoreWrap}>
                      <button
                        type="button"
                        className={styles.loadMoreBtn}
                        onClick={() => setVisibleHistoryCount(prev => prev + 5)}
                      >
                        <span>
                          {lang === "vi"
                            ? `Xem thêm lịch sử (${doc.events.length - visibleHistoryCount} còn lại)`
                            : lang === "zh"
                              ? `查看更多历史 (还剩 ${doc.events.length - visibleHistoryCount} 条)`
                              : `Load more history (${doc.events.length - visibleHistoryCount} remaining)`}
                        </span>
                        <ChevronDown size={15} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {view === "preferences" && (
            <section className={styles.panel}>
              <h2>{t.emailPrefs}</h2>
              <p>{t.emailPrefsHint}</p>
              <p className={styles.notice}>{doc.emailAvailable ? t.emailHint : x.unavailableEmail}</p>
              <h3>{t.timezone}</h3>
              <p>{snapshot?.timeZone}</p>
              <p>{t.timeNote}</p>
              <h3>{x.database}</h3>
              <p>{x.savedNote}</p>
              <button className={styles.secondary} onClick={() => setView("rules")}>
                {t.rules}<ArrowRight size={15}/>
              </button>
            </section>
          )}
        </>
      )}
      {calendarLedgerOpen && (
        <CalendarLedgerModal onClose={() => setCalendarLedgerOpen(false)} navigate={navigate} />
      )}
    </main>
  );
}
