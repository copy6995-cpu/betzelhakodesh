import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatNum } from "@/lib/utils";
import { ReminderControls } from "./ui";

export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  const now = new Date();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Open reminders whose date has arrived (today or earlier) — never future.
  const reminders = await prisma.reminder.findMany({
    where: { done: false, dueDate: { lte: now } },
    orderBy: { dueDate: "asc" },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          yeshiva: true,
          personalCode: true,
        },
      },
    },
  });

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[var(--color-primary)]">תזכורות</h1>
        <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">
          {reminders.length > 0
            ? `${formatNum(reminders.length)} תזכורות פעילות — מהיום של התזכורת עד "בוצע".`
            : "אין תזכורות פעילות כרגע."}
        </p>
      </div>

      {reminders.length === 0 ? (
        <div className="bg-white rounded-xl card-shadow p-10 text-center text-[var(--color-muted-foreground)]">
          הכול מטופל 🎉 — תזכורות נוספות אפשר להוסיף מכרטיס הבחור.
        </div>
      ) : (
        <div className="bg-white rounded-xl card-shadow divide-y divide-[var(--color-border)]/60">
          {reminders.map((r) => {
            const overdue = r.dueDate < todayStart;
            return (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        overdue
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {r.dueDate.toLocaleDateString("he-IL")}
                      {overdue ? " · באיחור" : " · להיום"}
                    </span>
                    <Link
                      href={`/bachurim/${r.student.id}`}
                      className="font-medium text-[var(--color-primary)] hover:text-[var(--color-accent)]"
                    >
                      {r.student.lastName} {r.student.firstName}
                    </Link>
                    <span className="text-xs text-[var(--color-muted-foreground)]">
                      · {r.student.yeshiva}
                    </span>
                  </div>
                  <div className="text-sm mt-1 whitespace-pre-wrap">{r.text}</div>
                </div>
                <ReminderControls id={r.id} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
