import { getSession } from "@/lib/auth-session";
import { bankCatalog } from "@/lib/bank-catalog";
export const runtime = "nodejs";
export async function GET(request: Request) {
  if (!await getSession()) return Response.json({error:"UNAUTHENTICATED"},{status:401,headers:{"Cache-Control":"no-store"}});
  const platform = new URL(request.url).searchParams.get("platform") === "ios" ? "ios" : "android";
  return Response.json(await bankCatalog(platform),{headers:{"Cache-Control":"private, max-age=300"}});
}
