import {
  PageSkeletonShell,
  TitleSkeleton,
  GridSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <PageSkeletonShell width="max-w-full">
      <TitleSkeleton />
      <GridSkeleton sections={2} perSection={21} />
    </PageSkeletonShell>
  );
}
