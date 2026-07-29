import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { physicalCode } from "@/lib/rooms";
import { RoomCapacityManager } from "./ui";

export const dynamic = "force-dynamic";

export default async function RoomsManagePage() {
  const rooms = await prisma.room.findMany({
    where: { active: true },
    orderBy: [{ building: "asc" }, { order: "asc" }],
    select: { id: true, code: true, capacity: true, building: true },
  });

  const buildings = new Map<
    string,
    { id: string; code: string; capacity: number | null; linked: boolean }[]
  >();
  for (const r of rooms) {
    const arr = buildings.get(r.building) ?? [];
    arr.push({
      id: r.id,
      code: r.code,
      capacity: r.capacity,
      linked: physicalCode(r.code) !== r.code,
    });
    buildings.set(r.building, arr);
  }

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link
          href="/rooms"
          className="text-xs text-[var(--color-muted-foreground)] hover:underline"
        >
          → חלוקת חדרים
        </Link>
        <h1 className="text-3xl font-bold text-[var(--color-primary)] mt-1">
          מספר מיטות בחדרים
        </h1>
        <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">
          כמה מיטות בכל חדר. נשמר עם היציאה מהתא. אפשר לייבא בבת אחת מקובץ המודל
          (עמודה C בגיליון &quot;רשימת חדרים&quot;). חדרים מחוברים (⛓) —
          המספר של כל חצי מסתכם יחד.
        </p>
      </div>

      <RoomCapacityManager
        buildings={[...buildings.entries()].map(([building, rms]) => ({
          building,
          rooms: rms,
        }))}
      />
    </div>
  );
}
