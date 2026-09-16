"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";

const AdminObserveRoom = dynamic(
  () =>
    import("@/components/admin/admin-observe-room").then((m) => ({
      default: m.AdminObserveRoom,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-dvh flex-col overflow-hidden">
        <Skeleton className="h-14 w-full shrink-0 rounded-none" />
        <div className="grid flex-1 gap-3 p-4 lg:grid-cols-[1fr_360px]">
          <Skeleton className="rounded-2xl" />
          <Skeleton className="rounded-2xl" />
        </div>
      </div>
    ),
  },
);

export default function AdminObservePage() {
  const params = useParams<{ id: string }>();
  return <AdminObserveRoom appointmentId={params.id} />;
}
