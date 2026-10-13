import { AuthPage, type AuthSearchParams } from "@/components/auth/AuthPage";
export default function ResetPasswordPage({ searchParams }: { searchParams: AuthSearchParams }) { return <AuthPage searchParams={searchParams} mode="reset" />; }
