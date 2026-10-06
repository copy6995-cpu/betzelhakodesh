import { SiteHeader } from "@/components/site-header";
import { NextAuthProvider } from "@/components/session-provider";
import { IdleTimeout } from "@/components/idle-timeout";
import { ExportSyncGuard } from "@/components/export-sync-guard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthProvider>
      <IdleTimeout />
      <ExportSyncGuard />
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1 page-bg">{children}</main>
      </div>
    </NextAuthProvider>
  );
}
