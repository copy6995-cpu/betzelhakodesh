import {
  PageSkeletonShell,
  TitleSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <PageSkeletonShell width="max-w-[1100px]">
      <TitleSkeleton />
      <TableSkeleton rows={10} cols={4} />
    </PageSkeletonShell>
  );
}
