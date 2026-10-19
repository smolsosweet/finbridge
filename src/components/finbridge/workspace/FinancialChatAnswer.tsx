import { Fragment } from "react";

/** Render a small, safe text format. All content remains escaped React text;
 * model-provided HTML, scripts and links are never interpreted. */
function emphasized(text: string) {
  return text.split(/(\*\*[^*]+\*\*|[−-]?\d[\d.,]*(?:\s\d{3})*\s(?:VND|USD|CNY|EUR|GBP|JPY|AUD|SGD)\b)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={index}>{part.slice(2, -2)}</strong>
      : /^[−-]?\d.*\s[A-Z]{3}$/.test(part) ? <strong key={index}>{part}</strong> : <Fragment key={index}>{part}</Fragment>);
}

export function FinancialChatAnswer({ text, calculationDetails, calculationLabel = "Calculation details" }: { text: string; calculationDetails?: string; calculationLabel?: string }) {
  return <div className="r-financial-chat-answer">{text.split(/\n\s*\n/).filter(Boolean).map((block, index) => {
    const lines = block.split("\n");
    if (/^(?:Giả định\/giới hạn|Assumptions\/limits|假设\/限制):/.test(lines[0])) {
      const colon = block.indexOf(":");
      const body = colon < 0 ? "" : block.slice(colon + 1).trim();
      if (!body || /^(?:Tính từ dữ liệu đã lưu trong FinBridge;|Calculated from saved FinBridge data\.|根据 FinBridge 已保存的数据计算)/.test(body)) return null;
      return <p key={index}>{emphasized(body)}</p>;
    }
    const heading = /^(?:Số liệu liên quan|Relevant figures|相关数据):$/.test(lines[0]);
    const content = heading ? lines.slice(1) : lines;
    const groups: Array<{ bullet: boolean; text: string }> = [];
    for (const line of content) {
      if (/^\s+/.test(line) && groups.length) groups[groups.length - 1].text += "\n" + line.trim();
      else groups.push({ bullet: /^•\s/.test(line), text: line.replace(/^•\s/, "") });
    }
    const runs: Array<{ bullet: boolean; items: string[] }> = [];
    for (const group of groups) {
      const last = runs[runs.length - 1];
      if (last?.bullet === group.bullet) last.items.push(group.text);
      else runs.push({ bullet: group.bullet, items: [group.text] });
    }
    return <section key={index}>
      {heading && <h3>{lines[0].slice(0, -1)}</h3>}
      {runs.map((run, groupIndex) => run.bullet
        ? <ul key={groupIndex}>{run.items.map((item, itemIndex) => <li key={itemIndex}>{emphasized(item)}</li>)}</ul>
        : <p key={groupIndex}>{emphasized(run.items.join("\n"))}</p>)}
    </section>;
  })}{calculationDetails && calculationDetails !== text && <details><summary>{calculationLabel}</summary>{calculationDetails.split(/\n\s*\n/).filter(Boolean).map((block, index) => <p key={index}>{emphasized(block)}</p>)}</details>}</div>;
}
