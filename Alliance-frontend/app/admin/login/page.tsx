import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, parseAdminSession, landingPathForRole } from "@/app/lib/admin-auth";
import { LoginForm } from "./login-form";
import { LoginAnimation } from "./login-animation";

export default async function AdminLoginPage() {
  const cookieStore = await cookies();
  const session = await parseAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (session) redirect(landingPathForRole(session.role));

  return (
    <div className="flex min-h-screen">
      {/* Left: form panel */}
      <div className="flex w-full flex-col justify-center px-6 py-8 sm:px-12 lg:w-[45%] lg:px-16 xl:px-20">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-2 flex justify-center lg:hidden">
            <div className="w-full max-w-55">
              <LoginAnimation />
            </div>
          </div>
          <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
            <Image
              src="/logo-mark.png"
              alt="AutoLink Integrated Technologies"
              width={56}
              height={56}
              className="mb-4 hidden size-12 object-contain lg:block"
            />
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              AutoLink<span className="text-accent">.</span> Admin
            </h1>
            <p className="mono-label mt-1 text-[9.5px] tracking-[0.14em] text-slate-400">
              AutoLink Integrated Technologies
            </p>
            <p className="mt-1.5 text-sm text-slate-500">Sign in to manage operations</p>
          </div>
          <LoginForm />
        </div>
      </div>

      {/* Right: brand / animation panel */}
      <div className="relative hidden overflow-hidden bg-linear-to-br from-primary via-primary to-primary-dark lg:flex lg:w-[55%] lg:items-center lg:justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.12),_transparent_55%)]" />
        <div className="relative flex w-full max-w-lg flex-col items-center px-10 text-center">
          <LoginAnimation />
          <h2 className="mt-4 text-2xl font-bold text-white">Run your business, from one place.</h2>
          <p className="mt-3 max-w-md text-sm text-white/70">
            Catalog, orders, quotations, and your team &mdash; all in a single premium dashboard built for AutoLink
            Integrated Technologies.
          </p>
        </div>
      </div>
    </div>
  );
}
