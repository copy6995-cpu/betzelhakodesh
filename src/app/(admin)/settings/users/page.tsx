import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { SECTIONS, parseSections } from "@/lib/sections";
import { UsersManager } from "./ui";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await auth();
  const me = session?.user as { id?: string; role?: string } | undefined;
  // Defense in depth — the edge proxy already blocks non-admins here.
  if (!me || me.role !== "admin") redirect("/");

  const rows = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, role: true, sections: true },
  });
  const users = rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role,
    sections: parseSections(r.sections),
  }));
  const sectionOptions = SECTIONS.map((s) => ({ key: s.key, label: s.label }));

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8" dir="rtl">
      <div className="mb-6">
        <Link
          href="/settings"
          className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)]"
        >
          ← חזרה להגדרות
        </Link>
        <h1 className="text-3xl font-bold text-[var(--color-primary)] mt-2">
          ניהול משתמשים
        </h1>
        <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">
          הוסף משתמשים ותן לכל אחד גישה למדורים הרלוונטיים. אדמין רואה הכול;
          משתמש רגיל רואה רק את המדורים שסומנו לו.
        </p>
      </div>

      <UsersManager
        users={users}
        sectionOptions={sectionOptions}
        currentUserId={me.id ?? ""}
      />
    </div>
  );
}
