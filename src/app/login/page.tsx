import { AuthPage, type AuthSearchParams } from "@/components/auth/AuthPage";
export default function LoginPage({ searchParams }: { searchParams: AuthSearchParams }) { return <AuthPage searchParams={searchParams} mode="login" />; }
