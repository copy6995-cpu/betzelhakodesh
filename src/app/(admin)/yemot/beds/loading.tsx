import {
  PageSkeletonShell,
  TitleSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <PageSkeletonShell width="max-w-full">
      <TitleSkeleton />
      <TableSkeleton rows={12} cols={7} />
    </PageSkeletonShell>
  );
}
