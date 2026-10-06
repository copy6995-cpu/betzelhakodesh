import {
  PageSkeletonShell,
  TitleSkeleton,
  CardsSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <PageSkeletonShell width="max-w-[1400px]">
      <TitleSkeleton />
      <div className="mb-6">
        <CardsSkeleton count={3} />
      </div>
      <TableSkeleton rows={6} cols={5} />
    </PageSkeletonShell>
  );
}
