import { AuthPage, type AuthSearchParams } from "@/components/auth/AuthPage";
export default function ForgotPasswordPage({ searchParams }: { searchParams: AuthSearchParams }) { return <AuthPage searchParams={searchParams} mode="forgot" />; }
