import { AuthPage, type AuthSearchParams } from "@/components/auth/AuthPage";
export default function SignupPage({ searchParams }: { searchParams: AuthSearchParams }) { return <AuthPage searchParams={searchParams} mode="signup" />; }
