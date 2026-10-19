import type { DraftAmountWarning } from "@/lib/draft-amount-warnings";
import { formatScenarioMoney, type ScenarioLanguage } from "@/lib/scenario-format";
import styles from "./DraftAmountWarnings.module.css";

const copy = {
  vi: {
    unusually_high: "Số tiền cao hơn thường lệ",
    unusually_low: "Số tiền thấp hơn thường lệ",
    exceeds_balance: "Khoản chi vượt số dư hiện tại",
    history: "Các khoản đã ghi gần đây trong danh mục",
    typical: "thường ở mức",
    balance: "Số dư đang ghi nhận của ví:",
    check: "Bạn kiểm tra lại số tiền và đơn vị tiền nhé. Nếu đúng, bạn vẫn có thể xác nhận; bản nháp chưa được lưu.",
  },
  en: {
    unusually_high: "Higher amount than usual",
    unusually_low: "Lower amount than usual",
    exceeds_balance: "Expense exceeds the current balance",
    history: "Recent recorded amounts in",
    typical: "are typically around",
    balance: "The wallet's recorded balance is",
    check: "Check the amount and currency. If correct, you can still confirm; the draft has not been saved.",
  },
  zh: {
    unusually_high: "金额高于往常",
    unusually_low: "金额低于往常",
    exceeds_balance: "支出超过当前余额",
    history: "近期已记录的类别",
    typical: "的金额通常约为",
    balance: "钱包记录的余额为：",
    check: "请核对金额和币种。若无误，仍可确认；草稿尚未保存。",
  },
};

export function DraftAmountWarnings({ warnings, language }: { warnings: DraftAmountWarning[]; language: ScenarioLanguage }) {
  if (!warnings.length) return null;
  const t = copy[language];
  return <aside className={styles.warning} role="status" aria-live="polite">
    {warnings.map(warning => <div key={warning.kind}>
      <strong>{t[warning.kind]}</strong>
      <p>{warning.kind === "exceeds_balance" ? t.balance : `${t.history} “${warning.category}” ${t.typical}`} <b>{formatScenarioMoney(warning.referenceAmount, warning.currency, language)}</b>.</p>
    </div>)}
    <p>{t.check}</p>
  </aside>;
}
