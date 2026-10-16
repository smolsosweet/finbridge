import type { BankCatalog, TransferApp, TransferBank } from "./bank-transfer";

// Public metadata only; no recipient, QR image, amount or user identifier is sent.
// Autofill capabilities checked against https://www.vietqr.io/deeplink/bank-apps.
const fallbackBanks: TransferBank[] = [
  {bin:"970415",code:"ICB",name:"VietinBank"},{bin:"970436",code:"VCB",name:"Vietcombank"},{bin:"970418",code:"BIDV",name:"BIDV"},{bin:"970448",code:"OCB",name:"OCB"},{bin:"970416",code:"ACB",name:"ACB"},{bin:"970422",code:"MB",name:"MBBank"},{bin:"970407",code:"TCB",name:"Techcombank"},{bin:"970432",code:"VPB",name:"VPBank"},
];
const fallbackApps: TransferApp[] = [{id:"icb",name:"VietinBank iPay",autofill:true},{id:"bidv",name:"BIDV SmartBanking",autofill:true},{id:"ocb",name:"OCB OMNI",autofill:true},{id:"acb",name:"ACB ONE",autofill:true},{id:"mb",name:"MB Bank",autofill:true},{id:"vcb",name:"VCB Digibank",autofill:false},{id:"tcb",name:"Techcombank Mobile",autofill:false},{id:"vpb",name:"VPBank NEO",autofill:false}];
const cache = new Map<string, { at: number; value: BankCatalog }>();
export async function bankCatalog(platform: "android" | "ios", fetcher = fetch): Promise<BankCatalog> {
  const hit = cache.get(platform); if (hit && Date.now() - hit.at < 3600000) return hit.value;
  try {
    const read = async (name: string) => { const response = await fetcher("https://api.vietqr.io/v2/" + name, { signal: AbortSignal.timeout(6000), redirect: "error" }); if (!response.ok) throw new Error("CATALOG_UNAVAILABLE"); const body = await response.text(); if (body.length > 300000) throw new Error("CATALOG_UNAVAILABLE"); return JSON.parse(body); };
    const [bankData, appData] = await Promise.all([read("banks"), read(platform + "-app-deeplinks")]);
    const banks: TransferBank[] = (Array.isArray(bankData.data) ? bankData.data : []).filter((b: Record<string, unknown>) => /^\d{6}$/.test(String(b.bin)) && /^[A-Za-z0-9]{1,30}$/.test(String(b.code)) && typeof b.shortName === "string").map((b: {bin:string;code:string;shortName:string}) => ({bin:b.bin,code:b.code,name:b.shortName.slice(0,100)}));
    const apps: TransferApp[] = (Array.isArray(appData.apps) ? appData.apps : []).filter((a: Record<string, unknown>) => /^[a-z0-9-]{1,30}$/.test(String(a.appId)) && typeof a.appName === "string").map((a: {appId:string;appName:string;autofill:number}) => ({id:a.appId,name:a.appName.slice(0,100),autofill:a.autofill===1}));
    if (!banks.length || !apps.length || banks.length > 200 || apps.length > 100) throw new Error("CATALOG_UNAVAILABLE");
    const value = {banks,apps,platform,fallback:false}; cache.set(platform,{at:Date.now(),value}); return value;
  } catch { return {banks:fallbackBanks,apps:fallbackApps,platform,fallback:true}; }
}
