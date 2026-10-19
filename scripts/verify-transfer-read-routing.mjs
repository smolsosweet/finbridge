import assert from "node:assert/strict";
import test from "node:test";
import { resolveTransferRead } from "../src/lib/transfer-chat-read.ts";

test("explicit current FX questions resolve independently of model availability in Vietnamese, English and Chinese",()=>{
  for (const message of ["Tỷ giá nhân dân tệ sang VND hiện có là bao nhiêu? Dữ liệu ngày nào?","Tỷ giá RMB/VND hôm nay?","What is the exchange rate from CNY to VND?","人民币兑越南盾汇率是多少？"]) {
    assert.deepEqual(resolveTransferRead(message),{operation:"rates",sourceCurrency:"CNY",targetCurrency:"VND"},message);
  }
  for(const message of ["10 triệu VND đổi được bao nhiêu tệ?","Bạn giúp tôi đổi 10 triệu VND sang nhân dân tệ nhé","10.000.000 VND đổi sang nhân dân tệ được bao nhiêu?","Convert 10 million VND to CNY"]) {
    assert.deepEqual(resolveTransferRead(message),{operation:"convert",amount:"10000000",sourceCurrency:"VND",targetCurrency:"CNY"},message);
  }
  assert.deepEqual(resolveTransferRead("100美元换成人民币"),{operation:"convert",amount:"100",sourceCurrency:"USD",targetCurrency:"CNY"});
  assert.deepEqual(resolveTransferRead("1,5 triệu VND đổi sang RMB"),{operation:"convert",amount:"1500000",sourceCurrency:"VND",targetCurrency:"CNY"});
  assert.deepEqual(resolveTransferRead("Convert 100 AUD to VND"),{operation:"convert",amount:"100",sourceCurrency:"AUD",targetCurrency:"VND"});
});

test("short FX follow-ups retain only explicit conversion inputs; missing currencies are clarified, never invented",()=>{
  const context={operation:"convert",amount:"100",sourceCurrency:"USD",targetCurrency:"VND"};
  assert.deepEqual(resolveTransferRead("Vậy 200 đô thì sao?",context),{operation:"convert",amount:"200",sourceCurrency:"USD",targetCurrency:"VND"});
  assert.deepEqual(resolveTransferRead("vậy đổi sang CNY thì sao",context),{operation:"convert",amount:"100",sourceCurrency:"USD",targetCurrency:"CNY"});
  assert.deepEqual(resolveTransferRead("Đổi 500 giúp tôi"),{operation:"convert",amount:"500"});
  assert.deepEqual(resolveTransferRead("Convert 500 to CNY"),{operation:"convert",amount:"500",targetCurrency:"CNY"});
  assert.equal(resolveTransferRead("200 USD",{operation:"save_bill",amount:"100",sourceCurrency:"CNY"}),null);
});

test("writes, actual spending, compound tasks, historical/future prices and ambiguous numbers retain model orchestration",()=>{
  const context={operation:"convert",amount:"100",sourceCurrency:"USD",targetCurrency:"VND"};
  for(const message of ["ăn sáng 10k tệ","tôi mua giày 200 USD","lưu ước tính đổi 100 USD sang VND","đổi 100 USD sang VND và tạo ngân sách","chuyển tiền 100 USD sang VND","tỷ giá CNY/VND hôm qua","tỷ giá CNY/VND ngày 20/10/2026","tỷ giá CNY/VND tháng trước","tỷ giá CNY/VND và tôi còn bao nhiêu tiền","Convert 1.234567 USD to VND","Convert 100 USD and 200 CNY to VND","Convert 100 EUR to VND","Convert 100 AED to VND","Tôi muốn bán 100 USD đổi sang VND","tỷ giá USD và CNY","100 USD có đủ tiền ăn không"]) {
    assert.equal(resolveTransferRead(message,context),null,message);
  }
  assert.deepEqual(resolveTransferRead("tỷ giá quốc tế"),{operation:"rates"});
});
