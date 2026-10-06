import {
  PageSkeletonShell,
  TitleSkeleton,
  PillsSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <PageSkeletonShell width="max-w-[1400px]">
      <TitleSkeleton />
      <PillsSkeleton count={8} />
      <PillsSkeleton count={7} />
      <TableSkeleton rows={12} cols={9} />
    </PageSkeletonShell>
  );
}
