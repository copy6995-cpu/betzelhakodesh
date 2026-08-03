import { auth } from "@/lib/auth";
import { ChangePasswordForm } from "./ui";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await auth();
  const user = session?.user as
    | { name?: string | null; email?: string | null }
    | undefined;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8" dir="rtl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[var(--color-primary)]">
          החשבון שלי
        </h1>
        <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">
          {user?.name || user?.email}
        </p>
      </div>

      <h2 className="text-lg font-semibold text-[var(--color-primary)] mb-3">
        החלפת סיסמה
      </h2>
      <ChangePasswordForm />
    </div>
  );
}
