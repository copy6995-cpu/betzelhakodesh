"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteStudent } from "../actions";

export function DeleteStudentButton({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        const { parentId } = await deleteStudent(studentId);
        setOpen(false);
        router.push(`/parents/${parentId}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "שגיאה במחיקה");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 h-10 rounded-lg border border-red-300 bg-white text-red-700 text-sm font-medium hover:bg-red-50 transition-colors"
      >
        מחק
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-[var(--color-primary)] mb-2">
              מחיקת בחור
            </h3>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              האם אתה בטוח שברצונך למחוק את <b>{studentName}</b>? כל התשלומים
              המשויכים אליו יימחקו גם הם. <b>פעולה זו לא הפיכה.</b>
            </p>
            {error && (
              <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="flex gap-2 justify-end mt-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 h-9 rounded-md border border-[var(--color-border)] text-sm"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={pending}
                className="px-4 h-9 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? "מוחק..." : "כן, מחק"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
