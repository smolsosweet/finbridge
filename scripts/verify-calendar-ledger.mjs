import assert from "node:assert/strict";
import {test} from "node:test";
import {ledgerDateKey} from "../src/components/sites/rolly/replica/calendarLedger.ts";

test("accounting dates retain their recorded day, including timestamps near midnight",()=>{
  for(const value of ["2026-10-18", "2026-10-18T23:59:00-07:00", "2026-10-18T00:01:00+14:00"])
    assert.equal(ledgerDateKey(value),"2026-10-18");
});
test("invalid dates are excluded instead of assigned to another day",()=>{
  for(const value of ["", "invalid", "2026-02-29", "2026-13-01", "2026-04-31"])
    assert.equal(ledgerDateKey(value),null);
  assert.equal(ledgerDateKey("2028-02-29T12:00:00"),"2028-02-29");
});
