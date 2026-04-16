import { SiteHeader } from "@/components/site-header";
import { NextAuthProvider } from "@/components/session-provider";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthProvider>
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1 page-bg">{children}</main>
      </div>
    </NextAuthProvider>
  );
}
