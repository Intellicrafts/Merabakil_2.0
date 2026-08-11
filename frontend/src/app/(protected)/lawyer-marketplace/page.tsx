"use client";

import { useMemo, useState } from "react";

import { AppointmentList } from "@/components/lawyer-marketplace/appointment-list";
import { BookingDialog } from "@/components/lawyer-marketplace/booking-dialog";
import { LawyerCard } from "@/components/lawyer-marketplace/lawyer-card";
import {
  LawyerFilters,
  type LawyerFilterState,
} from "@/components/lawyer-marketplace/lawyer-filters";
import { LiveMatchPanel } from "@/components/lawyer-marketplace/live-match/live-match-panel";
import { LawyerProfileDrawer } from "@/components/lawyer-marketplace/lawyer-profile-drawer";
import { MarketplaceHero } from "@/components/lawyer-marketplace/marketplace-hero";
import { TopMatchesStrip } from "@/components/lawyer-marketplace/top-matches-strip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listLawyers, listMyAppointments, type RankedLawyer } from "@/lib/marketplace-store";
import { MOCK_LAWYERS } from "@/lib/mock/lawyers";
import { cn } from "@/lib/utils";

export default function LawyerMarketplacePage() {
  const [tab, setTab] = useState("lawyers");
  const [filters, setFilters] = useState<LawyerFilterState>({
    query: "",
    practiceArea: "",
    city: "",
    verifiedOnly: false,
    sort: "match",
  });
  const [profileLawyer, setProfileLawyer] = useState<RankedLawyer | null>(null);
  const [bookingLawyer, setBookingLawyer] = useState<RankedLawyer | null>(null);
  const [appointmentsVersion, setAppointmentsVersion] = useState(0);

  const lawyers = useMemo(
    () =>
      listLawyers({
        query: filters.query,
        practiceArea: filters.practiceArea || undefined,
        city: filters.city || undefined,
        verifiedOnly: filters.verifiedOnly,
        sort: filters.sort,
      }),
    [filters],
  );

  const appointments = useMemo(
    () => listMyAppointments(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appointmentsVersion],
  );

  const verifiedCount = MOCK_LAWYERS.filter((l) => l.verified).length;
  const avgMatch =
    lawyers.length > 0
      ? Math.round(lawyers.reduce((s, l) => s + l.match_score, 0) / lawyers.length)
      : 0;

  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-5 pb-6 md:space-y-6 md:pb-8">
      <MarketplaceHero
        counselCount={MOCK_LAWYERS.length}
        verifiedCount={verifiedCount}
        avgMatch={avgMatch}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList
          className={cn(
            "h-10 w-full rounded-2xl bg-black/[0.04] p-1 dark:bg-white/[0.06]",
            "sm:w-auto",
          )}
        >
          <TabsTrigger
            value="lawyers"
            className="min-h-8 flex-1 rounded-xl px-4 text-[12px] font-semibold sm:flex-none"
          >
            Top Lawyers
          </TabsTrigger>
          <TabsTrigger
            value="appointments"
            className="min-h-8 flex-1 rounded-xl px-4 text-[12px] font-semibold sm:flex-none"
          >
            Appointments
            {appointments.length > 0 && (
              <span className="ml-1.5 rounded-full border border-slate-300/70 bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-zinc-200">
                {appointments.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lawyers" className="mt-4 space-y-5">
          <LiveMatchPanel onView={setProfileLawyer} onBook={setBookingLawyer} />

          <LawyerFilters value={filters} onChange={setFilters} />

          <TopMatchesStrip
            lawyers={lawyers}
            onView={setProfileLawyer}
            onBook={setBookingLawyer}
          />

          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Browse · {lawyers.length}
            </h2>
            <p className="text-[11px] text-muted-foreground/70">By {filters.sort}</p>
          </div>

          {lawyers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-black/[0.08] py-14 text-center dark:border-white/10">
              <p className="text-sm font-medium">No lawyers match your filters</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Try a broader practice area or clear the search.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
              {lawyers.map((lawyer, index) => (
                <LawyerCard
                  key={lawyer.id}
                  lawyer={lawyer}
                  index={index}
                  onView={setProfileLawyer}
                  onBook={setBookingLawyer}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="appointments" className="mt-4">
          <AppointmentList appointments={appointments} />
        </TabsContent>
      </Tabs>

      <LawyerProfileDrawer
        lawyer={profileLawyer}
        open={Boolean(profileLawyer)}
        onClose={() => setProfileLawyer(null)}
        onBook={setBookingLawyer}
      />

      <BookingDialog
        lawyer={bookingLawyer}
        open={Boolean(bookingLawyer)}
        onClose={() => setBookingLawyer(null)}
        onBooked={() => {
          setAppointmentsVersion((v) => v + 1);
          setTab("appointments");
        }}
      />
    </div>
  );
}
