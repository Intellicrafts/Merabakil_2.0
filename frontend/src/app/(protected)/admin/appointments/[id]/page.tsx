"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";

const AppointmentCommandCenter = dynamic(
  () =>
    import("@/components/admin/appointment-command-center").then((m) => ({
      default: m.AppointmentCommandCenter,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    ),
  },
);

export default function AdminAppointmentCommandPage() {
  const params = useParams<{ id: string }>();
  return <AppointmentCommandCenter appointmentId={params.id} />;
}
