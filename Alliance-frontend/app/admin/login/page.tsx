import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, parseAdminSession, landingPathForRole } from "@/app/lib/admin-auth";
import { LoginForm } from "./login-form";

export default async function AdminLoginPage() {
  const cookieStore = await cookies();
  const session = parseAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (session) redirect(landingPathForRole(session.role));

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#0e2a3f,_#0a1622_65%)] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/logo-mark.png" alt="AutoLink" width={56} height={56} className="mb-3 size-14 object-contain" />
          <h1 className="text-xl font-bold text-white">
            AutoLink<span className="text-accent">.</span> Admin
          </h1>
          <p className="mt-1 text-sm text-white/50">Sign in to manage operations</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
