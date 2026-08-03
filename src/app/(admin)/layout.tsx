import { SiteHeader } from "@/components/site-header";
import { NextAuthProvider } from "@/components/session-provider";
import { IdleTimeout } from "@/components/idle-timeout";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthProvider>
      <IdleTimeout />
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1 page-bg">{children}</main>
      </div>
    </NextAuthProvider>
  );
}
