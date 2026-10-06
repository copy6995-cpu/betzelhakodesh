import {
  PageSkeletonShell,
  TitleSkeleton,
  GridSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <PageSkeletonShell width="max-w-[1600px]">
      <TitleSkeleton />
      <GridSkeleton sections={4} perSection={14} />
    </PageSkeletonShell>
  );
}
