"use client";

import { useEffect, useMemo, useState } from "react";

import { AppointmentList } from "@/components/lawyer-marketplace/appointment-list";
import { BookingDialog } from "@/components/lawyer-marketplace/booking-dialog";
import { LawyerCard } from "@/components/lawyer-marketplace/lawyer-card";
import { MyListingEditor } from "@/components/lawyer-marketplace/my-listing-editor";
import {
  LawyerFilters,
  type LawyerFilterState,
} from "@/components/lawyer-marketplace/lawyer-filters";
import { LiveMatchPanel } from "@/components/lawyer-marketplace/live-match/live-match-panel";
import { LawyerProfileDrawer } from "@/components/lawyer-marketplace/lawyer-profile-drawer";
import { MarketplaceHero } from "@/components/lawyer-marketplace/marketplace-hero";
import { TopMatchesStrip } from "@/components/lawyer-marketplace/top-matches-strip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  fetchMarketplaceLawyers,
  getAppointmentJoinState,
  listAppointments,
  syncAdvocateListing,
} from "@/lib/api";
import type { AppointmentRecord } from "@/lib/appointment-types";
import { listLawyers, toRankedLawyer, type RankedLawyer } from "@/lib/marketplace-store";
import { cn } from "@/lib/utils";

export default function LawyerMarketplacePage() {
  const [tab, setTab] = useState("lawyers");
  const [filters, setFilters] = useState<LawyerFilterState>({
    query: "",
    practiceArea: "",
    city: "",
    verifiedOnly: true,
    sort: "match",
  });
  const [catalog, setCatalog] = useState<RankedLawyer[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [profileLawyer, setProfileLawyer] = useState<RankedLawyer | null>(null);
  const [bookingLawyer, setBookingLawyer] = useState<RankedLawyer | null>(null);
  const [bookingSource, setBookingSource] = useState<"ai_match" | "manual">("manual");
  const [appointmentsVersion, setAppointmentsVersion] = useState(0);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [catalogTick, setCatalogTick] = useState(0);
  const debouncedQuery = useDebouncedValue(filters.query, 300);

  useEffect(() => {
    void syncAdvocateListing();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);
    fetchMarketplaceLawyers({
      query: debouncedQuery || undefined,
      practiceArea: filters.practiceArea || undefined,
      city: filters.city || undefined,
      verified: filters.verifiedOnly,
    })
      .then((rows) => {
        if (!cancelled) {
          setCatalog(rows.map(toRankedLawyer));
          setCatalogError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setCatalogError(err.message);
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, filters.practiceArea, filters.city, filters.verifiedOnly, catalogTick]);

  useEffect(() => {
    let cancelled = false;
    setAppointmentsLoading(true);
    const load = async () => {
      try {
        const rows = await listAppointments();
        if (!cancelled) setAppointments(rows);
      } catch {
        /* list surfaces empty */
      } finally {
        if (!cancelled) setAppointmentsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [appointmentsVersion]);

  useEffect(() => {
    if (appointments.length === 0) return undefined;
    const poll = async () => {
      const updates = await Promise.all(
        appointments
          .filter((a) => a.join_state !== "expired" && a.status !== "cancelled")
          .map(async (apt) => {
            try {
              return { id: apt.id, join: await getAppointmentJoinState(apt.id) };
            } catch {
              return null;
            }
          }),
      );
      setAppointments((prev) =>
        prev.map((row) => {
          const hit = updates.find((u) => u && u.id === row.id);
          if (!hit) return row;
          return {
            ...row,
            join_state: hit.join.join_state,
            seconds_until_start: hit.join.seconds_until_start,
            seconds_until_end: hit.join.seconds_until_end,
            opponent_present: hit.join.opponent_present,
            pending_summon: hit.join.pending_summon,
            last_summon_at: hit.join.last_summon_at ?? row.last_summon_at,
            prior_join: hit.join.prior_join ?? row.prior_join,
            priority: hit.join.priority ?? row.priority,
            emergency_status: hit.join.emergency_status ?? row.emergency_status,
            emergency_reason: hit.join.emergency_reason ?? row.emergency_reason,
            status: (hit.join.status as AppointmentRecord["status"]) ?? row.status,
          };
        }),
      );
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 8000);
    const onFocus = () => void poll();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [appointments.map((a) => a.id).join(",")]);

  const lawyers = useMemo(
    () =>
      listLawyers(catalog, {
        query: filters.query,
        practiceArea: filters.practiceArea || undefined,
        city: filters.city || undefined,
        verifiedOnly: filters.verifiedOnly,
        sort: filters.sort,
      }),
    [catalog, filters],
  );

  const verifiedCount = catalog.filter((l) => l.verified).length;
  const avgMatch =
    lawyers.length > 0
      ? Math.round(lawyers.reduce((s, l) => s + l.match_score, 0) / lawyers.length)
      : 0;

  function bookManual(lawyer: RankedLawyer) {
    setBookingSource("manual");
    setBookingLawyer(lawyer);
  }

  function bookMatch(lawyer: RankedLawyer) {
    setBookingSource("ai_match");
    setBookingLawyer(lawyer);
  }

  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-5 pb-6 md:space-y-6 md:pb-8">
      <MarketplaceHero
        counselCount={catalog.length}
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
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lawyers" className="mt-4 space-y-5">
          <MyListingEditor onSaved={() => setCatalogTick((n) => n + 1)} />
          <LiveMatchPanel catalog={catalog} onView={setProfileLawyer} onBook={bookMatch} />

          <LawyerFilters value={filters} onChange={setFilters} />

          <TopMatchesStrip
            lawyers={lawyers}
            onView={setProfileLawyer}
            onBook={bookManual}
          />

          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Browse · {lawyers.length}
            </h2>
            <p className="text-[11px] text-muted-foreground/70">By {filters.sort}</p>
          </div>

          {catalogLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-44 animate-pulse rounded-2xl border border-black/[0.06] bg-white/40 dark:border-white/10"
                />
              ))}
            </div>
          ) : catalogError ? (
            <div className="rounded-2xl border border-dashed border-black/[0.08] py-14 text-center dark:border-white/10">
              <p className="text-sm font-medium">Could not load counsel</p>
              <p className="mt-1 text-[13px] text-muted-foreground">{catalogError}</p>
            </div>
          ) : lawyers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-black/[0.08] px-6 py-14 text-center dark:border-white/10">
              <p className="text-sm font-medium">
                {catalog.length === 0
                  ? "No verified registered advocates yet"
                  : "No lawyers match your filters"}
              </p>
              <p className="mx-auto mt-1 max-w-md text-[13px] text-muted-foreground">
                {catalog.length === 0
                  ? "Only advocates who registered in this app and are verified appear here. Ask counsel to sign up with the advocate role."
                  : "Try a broader practice area or clear the search."}
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
                  onBook={bookManual}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="appointments" className="mt-4">
          {appointmentsLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-32 w-full rounded-2xl" />
              ))}
            </div>
          ) : (
            <AppointmentList
              appointments={appointments}
              onChanged={() => setAppointmentsVersion((v) => v + 1)}
            />
          )}
        </TabsContent>
      </Tabs>

      <LawyerProfileDrawer
        lawyer={profileLawyer}
        open={Boolean(profileLawyer)}
        onClose={() => setProfileLawyer(null)}
        onBook={bookManual}
      />

      <BookingDialog
        lawyer={bookingLawyer}
        open={Boolean(bookingLawyer)}
        source={bookingSource}
        onClose={() => setBookingLawyer(null)}
        onBooked={() => {
          setAppointmentsVersion((v) => v + 1);
          setTab("appointments");
        }}
      />
    </div>
  );
}
