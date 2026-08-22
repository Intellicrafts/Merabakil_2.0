"use client";

import { useParams } from "next/navigation";

import { AppointmentRoom } from "@/components/appointment-room/appointment-room";

export default function AppointmentRoomPage() {
  const params = useParams<{ id: string }>();
  return <AppointmentRoom appointmentId={params.id} />;
}
