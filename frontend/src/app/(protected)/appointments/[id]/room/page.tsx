"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";

const AppointmentRoom = dynamic(
  () =>
    import("@/components/appointment-room/appointment-room").then((m) => ({
      default: m.AppointmentRoom,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto w-full max-w-[680px] space-y-4 px-4 py-6">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    ),
  },
);

export default function AppointmentRoomPage() {
  const params = useParams<{ id: string }>();
  return <AppointmentRoom appointmentId={params.id} />;
}
