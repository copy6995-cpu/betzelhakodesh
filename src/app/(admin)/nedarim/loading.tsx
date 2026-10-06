import {
  PageSkeletonShell,
  TitleSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

// Covers every nedarim sub-route (hoks, forms, transactions, duplicates).
export default function Loading() {
  return (
    <PageSkeletonShell width="max-w-[1400px]">
      <TitleSkeleton />
      <TableSkeleton rows={12} cols={6} />
    </PageSkeletonShell>
  );
}
