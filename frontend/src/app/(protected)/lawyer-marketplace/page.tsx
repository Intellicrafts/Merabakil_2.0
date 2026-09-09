"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { AppointmentList } from "@/components/lawyer-marketplace/appointment-list";
import { BookingDialog } from "@/components/lawyer-marketplace/booking-dialog";
import { LawyerCard } from "@/components/lawyer-marketplace/lawyer-card";
import { Input } from "@/components/ui/input";
import {
  LawyerFilters,
  type LawyerFilterState,
} from "@/components/lawyer-marketplace/lawyer-filters";
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

type AptStatusFilter = "all" | "upcoming" | "completed" | "cancelled";
type AptDateFilter = "all" | "week" | "month" | "3months";

function ConsultationFilterBar({
  search, onSearch, status, onStatus, date, onDate, total, filtered,
}: {
  search: string; onSearch: (v: string) => void;
  status: AptStatusFilter; onStatus: (v: AptStatusFilter) => void;
  date: AptDateFilter; onDate: (v: AptDateFilter) => void;
  total: number; filtered: number;
}) {
  const isActive = search.trim() !== "" || status !== "all" || date !== "all";
  const sel = "h-9 rounded-xl border border-input bg-background px-3 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search by name…" className="h-9 w-44 rounded-xl pl-8 text-[13px] sm:w-52" />
      </div>
      <select value={status} onChange={(e) => onStatus(e.target.value as AptStatusFilter)} className={sel} aria-label="Filter by status">
        <option value="all">All statuses</option>
        <option value="upcoming">Upcoming</option>
        <option value="completed">Completed</option>
        <option value="cancelled">Cancelled</option>
      </select>
      <select value={date} onChange={(e) => onDate(e.target.value as AptDateFilter)} className={sel} aria-label="Filter by date">
        <option value="all">All time</option>
        <option value="week">This week</option>
        <option value="month">This month</option>
        <option value="3months">Last 3 months</option>
      </select>
      {isActive && (
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-muted-foreground">{filtered} of {total}</span>
          <button type="button" onClick={() => { onSearch(""); onStatus("all"); onDate("all"); }} className="inline-flex items-center gap-1 text-[12px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            <X className="h-3 w-3" /> Clear
          </button>
        </div>
      )}
    </div>
  );
}

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
  const [appointmentsVersion, setAppointmentsVersion] = useState(0);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [aptSearch, setAptSearch] = useState("");
  const [aptStatus, setAptStatus] = useState<AptStatusFilter>("all");
  const [aptDate, setAptDate] = useState<AptDateFilter>("all");
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

  const filteredAppointments = useMemo(() => appointments.filter((a) => {
    if (aptSearch.trim()) {
      const q = aptSearch.toLowerCase();
      if (!(a.counterpart_name ?? a.citizen_name ?? "").toLowerCase().includes(q)) return false;
    }
    if (aptStatus === "upcoming" && !["requested","confirmed","live"].includes(a.status)) return false;
    if (aptStatus === "completed" && a.status !== "completed") return false;
    if (aptStatus === "cancelled" && !["cancelled","expired","no_show"].includes(a.status)) return false;
    if (aptDate !== "all" && a.scheduled_at) {
      const days = ({ week: 7, month: 30, "3months": 90 } as const)[aptDate];
      if (new Date(a.scheduled_at).getTime() < Date.now() - days * 86_400_000) return false;
    }
    return true;
  }), [appointments, aptSearch, aptStatus, aptDate]);

  const verifiedCount = catalog.filter((l) => l.verified).length;
  const avgMatch =
    lawyers.length > 0
      ? Math.round(lawyers.reduce((s, l) => s + l.match_score, 0) / lawyers.length)
      : 0;

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-3 pb-8 sm:space-y-6 sm:pb-10">
      <MarketplaceHero
        counselCount={catalog.length}
        verifiedCount={verifiedCount}
        avgMatch={avgMatch}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList
          className={cn(
            "h-11 w-full rounded-2xl bg-black/[0.04] p-1 dark:bg-white/[0.06]",
            "sm:h-10 sm:w-auto",
          )}
        >
          <TabsTrigger
            value="lawyers"
            className="min-h-9 flex-1 rounded-xl px-4 text-[13px] font-semibold sm:min-h-8 sm:flex-none sm:text-[12px]"
          >
            <span className="sm:hidden">Advocates</span>
            <span className="hidden sm:inline">Find an Advocate</span>
          </TabsTrigger>
          <TabsTrigger
            value="appointments"
            className="min-h-9 flex-1 rounded-xl px-4 text-[13px] font-semibold sm:min-h-8 sm:flex-none sm:text-[12px]"
          >
            <span className="sm:hidden">Bookings</span>
            <span className="hidden sm:inline">My Consultations</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lawyers" className="mt-3 space-y-4 sm:mt-5 sm:space-y-5">
          <LawyerFilters value={filters} onChange={setFilters} />

          <TopMatchesStrip
            lawyers={lawyers}
            onView={setProfileLawyer}
            onBook={(l) => setBookingLawyer(l)}
          />

          <div className="flex items-baseline justify-between gap-3 px-0.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <span className="sm:hidden">Matches ({lawyers.length})</span>
              <span className="hidden sm:inline">All Advocates ({lawyers.length})</span>
            </h2>
            <p className="hidden text-[12px] text-muted-foreground/70 sm:block">
              Sorted by {filters.sort}
            </p>
          </div>

          {catalogLoading ? (
            <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 lg:gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-[4.75rem] animate-pulse rounded-[1.15rem] border border-black/[0.06] bg-white/40 dark:border-white/10 sm:h-56"
                />
              ))}
            </div>
          ) : catalogError ? (
            <div className="rounded-2xl border border-dashed border-black/[0.08] px-5 py-12 text-center dark:border-white/10">
              <p className="text-sm font-medium">Unable to load advocates</p>
              <p className="mt-1 text-[13px] text-muted-foreground">Please try refreshing the page.</p>
            </div>
          ) : lawyers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-black/[0.08] px-5 py-12 text-center dark:border-white/10">
              <p className="text-sm font-medium">
                {catalog.length === 0
                  ? "No advocates listed yet"
                  : "No advocates match your filters"}
              </p>
              <p className="mx-auto mt-1 max-w-md text-[13px] text-muted-foreground">
                {catalog.length === 0
                  ? "Verified advocates will appear here once they join the platform."
                  : "Try a broader practice area or clear the search."}
              </p>
            </div>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 lg:gap-4">
              {lawyers.map((lawyer, index) => (
                <LawyerCard
                  key={lawyer.id}
                  lawyer={lawyer}
                  index={index}
                  onView={setProfileLawyer}
                  onBook={(l) => setBookingLawyer(l)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="appointments" className="mt-4 space-y-4">
          {!appointmentsLoading && (
            <ConsultationFilterBar
              search={aptSearch} onSearch={setAptSearch}
              status={aptStatus} onStatus={setAptStatus}
              date={aptDate} onDate={setAptDate}
              total={appointments.length} filtered={filteredAppointments.length}
            />
          )}
          {appointmentsLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-32 w-full rounded-2xl" />
              ))}
            </div>
          ) : (
            <AppointmentList
              appointments={filteredAppointments}
              onChanged={() => setAppointmentsVersion((v) => v + 1)}
            />
          )}
        </TabsContent>
      </Tabs>

      <LawyerProfileDrawer
        lawyer={profileLawyer}
        open={Boolean(profileLawyer)}
        onClose={() => setProfileLawyer(null)}
        onBook={(l) => setBookingLawyer(l)}
      />

      <BookingDialog
        lawyer={bookingLawyer}
        open={Boolean(bookingLawyer)}
        source="manual"
        onClose={() => setBookingLawyer(null)}
        onBooked={() => {
          setAppointmentsVersion((v) => v + 1);
          setTab("appointments");
        }}
      />
    </div>
  );
}
