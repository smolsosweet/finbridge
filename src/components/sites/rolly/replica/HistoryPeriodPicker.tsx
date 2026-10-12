"use client";

import { useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Modal } from "./Ui";
import { calendarWeek, localDateKey, shiftCalendarWeek } from "./chartWeek";

export type HistoryPeriod = {
  kind: "day" | "week" | "month" | "year" | "all" | "custom";
  day: string;
  month: number;
  year: number;
  from: string;
  to: string;
};

export function matchesHistoryPeriod(date: string, period: HistoryPeriod): boolean {
  const key = date.slice(0, 10);
  if (period.kind === "day") return key === period.day;
  if (period.kind === "month") return key.startsWith(period.year + "-" + String(period.month + 1).padStart(2, "0"));
  if (period.kind === "year") return key.startsWith(period.year + "-");
  if (period.kind === "week") {
    const week = calendarWeek(period.day);
    return key >= week.start && key <= week.end;
  }
  if (period.kind === "custom") return (!period.from || key >= period.from) && (!period.to || key <= period.to) && !(period.from && period.to && period.from > period.to);
  return true;
}

const COPY = {
  vi: { day: "Ngày", week: "Tuần", month: "Tháng", year: "Năm", all: "Mọi thời gian", custom: "Phạm vi tùy chỉnh", choose: "Chọn khoảng thời gian", detail: "Chọn thời gian chi tiết", close: "Đóng", confirm: "Xác nhận", today: "Hôm nay", from: "Từ ngày", to: "Đến ngày", previousYear: "Năm trước", nextYear: "Năm sau", previousWeek: "Tuần trước", nextWeek: "Tuần sau", thisWeek: "Tuần này", selectWeek: "Chọn một ngày trong tuần" },
  en: { day: "Day", week: "Week", month: "Month", year: "Year", all: "All time", custom: "Custom range", choose: "Choose time period", detail: "Choose dates", close: "Close", confirm: "Apply", today: "Today", from: "From", to: "To", previousYear: "Previous year", nextYear: "Next year", previousWeek: "Previous week", nextWeek: "Next week", thisWeek: "This week", selectWeek: "Choose a date in the week" },
  zh: { day: "日", week: "周", month: "月", year: "年", all: "全部时间", custom: "自定义范围", choose: "选择时间范围", detail: "选择日期", close: "关闭", confirm: "确认", today: "今天", from: "开始日期", to: "结束日期", previousYear: "上一年", nextYear: "下一年", previousWeek: "上一周", nextWeek: "下一周", thisWeek: "本周", selectWeek: "选择周内日期" },
};

export function HistoryPeriodPicker({ value, onChange, lang }: { value: HistoryPeriod; onChange: (value: HistoryPeriod) => void; lang: "vi" | "en" | "zh" }) {
  const [panel, setPanel] = useState<"period" | "dates" | "">("");
  const t = COPY[lang];
  const locale = lang === "vi" ? "vi-VN" : lang === "zh" ? "zh-CN" : "en-GB";
  const formatDay = (key: string) => key ? new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(key + "T12:00:00")) : "—";
  const week = calendarWeek(value.day);
  const periodLabel = value.kind === "month" ? new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(value.year, value.month, 1))
    : value.kind === "year" ? String(value.year) : value.kind === "day" ? formatDay(value.day)
      : value.kind === "week" ? formatDay(week.start) + " – " + formatDay(week.end)
        : formatDay(value.from) + " – " + formatDay(value.to);
  const update = (change: Partial<HistoryPeriod>) => onChange({ ...value, ...change });
  return <>
    <div className="r-period-controls fb-history-period">
      <button type="button" className="r-period" onClick={() => setPanel("period")}>{t[value.kind]}<CalendarDays size={17} /><ChevronDown size={15} /></button>
      {value.kind !== "all" && <button type="button" className="r-period-date" aria-label={t.detail} onClick={() => setPanel("dates")}>{periodLabel}<ChevronDown size={15} /></button>}
    </div>
    {panel && <Modal title={panel === "period" ? t.choose : t.detail} sheet={panel === "period"} onClose={() => setPanel("")}>
      {panel === "period" ? <div className="r-period-options">{(["day", "week", "month", "year", "all", "custom"] as const).map((kind) => <button type="button" key={kind} className={value.kind === kind ? "is-selected" : ""} onClick={() => { update({ kind }); setPanel(kind === "all" ? "" : "dates"); }}><CalendarDays size={20} />{t[kind]}</button>)}</div> : <div className="fb-date-picker-modal">
        {(value.kind === "month" || value.kind === "year") && <>
          <div className="fb-month-year-header"><button type="button" className="fb-stepper-btn" aria-label={t.previousYear} onClick={() => update({ year: value.year - 1 })}><ChevronLeft size={18} /></button><span className="fb-year-display">{value.year}</span><button type="button" className="fb-stepper-btn" aria-label={t.nextYear} onClick={() => update({ year: value.year + 1 })}><ChevronRight size={18} /></button></div>
          {value.kind === "month" ? <div className="fb-month-grid">{Array.from({ length: 12 }, (_, month) => <button type="button" key={month} className={"fb-month-cell " + (value.month === month ? "active" : "")} onClick={() => update({ month })}>{new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(value.year, month, 1))}</button>)}</div> : <div className="fb-year-grid">{Array.from({ length: 6 }, (_, offset) => value.year - 2 + offset).map((year) => <button type="button" key={year} className={"fb-year-cell " + (value.year === year ? "active" : "")} onClick={() => update({ year })}>{year}</button>)}</div>}
        </>}
        {value.kind === "day" && <><label className="fb-picker-field"><span className="fb-picker-label">{t.day}</span><input type="date" value={value.day} onInput={(event) => { if (event.currentTarget.validity.valid && event.currentTarget.value) update({ day: event.currentTarget.value }); }} /></label><button type="button" className="fb-quick-date-btn" onClick={() => update({ day: localDateKey(new Date()) })}>{t.today}</button></>}
        {value.kind === "week" && <><div className="fb-week-stepper"><button type="button" className="fb-stepper-btn" aria-label={t.previousWeek} onClick={() => update({ day: shiftCalendarWeek(week.start, -1) })}><ChevronLeft size={18} /></button><b>{periodLabel}</b><button type="button" className="fb-stepper-btn" aria-label={t.nextWeek} onClick={() => update({ day: shiftCalendarWeek(week.start, 1) })}><ChevronRight size={18} /></button></div><label className="fb-picker-field"><span className="fb-picker-label">{t.selectWeek}</span><input type="date" value={value.day} onInput={(event) => { if (event.currentTarget.validity.valid && event.currentTarget.value) update({ day: event.currentTarget.value }); }} /></label><button type="button" className="fb-quick-date-btn" onClick={() => update({ day: localDateKey(new Date()) })}>{t.thisWeek}</button></>}
        {value.kind === "custom" && <div className="fb-history-range"><label><span>{t.from}</span><input type="date" value={value.from} max={value.to || undefined} onInput={(event) => update({ from: event.currentTarget.value })} /></label><label><span>{t.to}</span><input type="date" value={value.to} min={value.from || undefined} onInput={(event) => update({ to: event.currentTarget.value })} /></label></div>}
        <div className="fb-modal-actions"><button type="button" className="r-secondary" onClick={() => setPanel("")}>{t.close}</button><button type="button" className="r-primary" onClick={() => setPanel("")} disabled={value.kind === "custom" && !!value.from && !!value.to && value.from > value.to}>{t.confirm}</button></div>
      </div>}
    </Modal>}
  </>;
}
