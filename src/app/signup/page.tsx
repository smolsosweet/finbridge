import { redirect } from "next/navigation";
// Google creates the account on first successful sign-in; no fake password signup.
export default function SignupPage() { redirect("/login"); }