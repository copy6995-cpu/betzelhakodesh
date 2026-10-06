import {
  PageSkeletonShell,
  TitleSkeleton,
  CardsSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <PageSkeletonShell width="max-w-4xl">
      <TitleSkeleton />
      <CardsSkeleton count={6} />
    </PageSkeletonShell>
  );
}
