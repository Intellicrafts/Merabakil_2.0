"use client";

import { useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";

import { AppointmentList } from "@/components/lawyer-marketplace/appointment-list";
import { BookingDialog } from "@/components/lawyer-marketplace/booking-dialog";
import {
  ConsultationFilters,
  type ConsultationDateFilter,
  type ConsultationStatusFilter,
} from "@/components/lawyer-marketplace/consultation-filters";
import { ConsultationsHero } from "@/components/lawyer-marketplace/consultations-hero";
import { LawyerCard } from "@/components/lawyer-marketplace/lawyer-card";
import {
  LawyerFilters,
  type LawyerFilterState,
} from "@/components/lawyer-marketplace/lawyer-filters";
import { LawyerProfileDrawer } from "@/components/lawyer-marketplace/lawyer-profile-drawer";
import { MarketplaceHero } from "@/components/lawyer-marketplace/marketplace-hero";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import {
  fetchMarketplaceLawyers,
  getAppointmentJoinState,
  listAppointments,
  syncAdvocateListing,
} from "@/lib/api";
import type { AppointmentRecord } from "@/lib/appointment-types";
import { useTranslation } from "@/lib/i18n";
import { listLawyers, toRankedLawyer, type RankedLawyer } from "@/lib/marketplace-store";
import { cn } from "@/lib/utils";

export default function LawyerMarketplacePage() {
  const { t } = useTranslation();
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
  const [aptStatus, setAptStatus] = useState<ConsultationStatusFilter>("all");
  const [aptDate, setAptDate] = useState<ConsultationDateFilter>("all");
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
    const onChanged = () => setAppointmentsVersion((v) => v + 1);
    window.addEventListener("legalos:appointments-changed", onChanged);
    return () => window.removeEventListener("legalos:appointments-changed", onChanged);
  }, []);

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

  const filterResetKey = `${debouncedQuery}|${filters.practiceArea}|${filters.city}|${filters.verifiedOnly}|${filters.sort}|${catalog.length}`;
  const { visibleCount, sentinelRef, hasMore } = useInfiniteScroll(
    lawyers.length,
    filterResetKey,
  );
  const visibleLawyers = lawyers.slice(0, visibleCount);

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

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-3 pb-8 sm:space-y-6 sm:pb-10">
      <MarketplaceHero
        counselCount={catalog.length}
        verifiedCount={verifiedCount}
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
            className="min-h-9 flex-1 rounded-xl px-4 text-[13px] font-semibold transition-all duration-200 data-[state=active]:shadow-sm sm:min-h-8 sm:flex-none sm:text-[12px]"
          >
            <span className="sm:hidden">{t("marketplace.advocates")}</span>
            <span className="hidden sm:inline">{t("marketplace.findAdvocate")}</span>
          </TabsTrigger>
          <TabsTrigger
            value="appointments"
            className="min-h-9 flex-1 rounded-xl px-4 text-[13px] font-semibold transition-all duration-200 data-[state=active]:shadow-sm sm:min-h-8 sm:flex-none sm:text-[12px]"
          >
            <span className="sm:hidden">{t("marketplace.bookings")}</span>
            <span className="hidden sm:inline">{t("appointments.myConsultations")}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lawyers" className="mt-3 space-y-4 sm:mt-5 sm:space-y-5">
          <LawyerFilters value={filters} onChange={setFilters} />

          <div className="flex items-center justify-between gap-3 px-0.5">
            <h2 className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-foreground sm:text-[13px]">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span>
                {lawyers.length} {lawyers.length === 1 ? "advocate" : "advocates"}
              </span>
            </h2>
            <p className="hidden text-[12px] text-muted-foreground/70 sm:block">
              {t("marketplace.sortedBy")} {filters.sort}
            </p>
          </div>

          {catalogLoading ? (
            <div className="flex flex-col gap-2 sm:gap-2.5">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-[7.5rem] animate-pulse rounded-[1.25rem] border border-black/[0.06] bg-white/40 dark:border-white/10 sm:h-[5.75rem]"
                />
              ))}
            </div>
          ) : catalogError ? (
            <div className="rounded-2xl border border-dashed border-black/[0.08] px-5 py-12 text-center dark:border-white/10">
              <p className="text-sm font-medium">{t("marketplace.unableToLoad")}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">{t("marketplace.tryRefresh")}</p>
            </div>
          ) : lawyers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-black/[0.08] px-5 py-12 text-center dark:border-white/10">
              <p className="text-sm font-medium">
                {catalog.length === 0 ? t("marketplace.noAdvocates") : t("marketplace.noMatches")}
              </p>
              <p className="mx-auto mt-1 max-w-md text-[13px] text-muted-foreground">
                {catalog.length === 0 ? t("marketplace.advocatesWillAppear") : t("marketplace.tryBroader")}
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2 sm:gap-2.5">
                {visibleLawyers.map((lawyer, index) => (
                  <LawyerCard
                    key={lawyer.id}
                    lawyer={lawyer}
                    index={index}
                    onView={setProfileLawyer}
                    onBook={(l) => setBookingLawyer(l)}
                  />
                ))}
              </div>
              {hasMore && (
                <div ref={sentinelRef} className="flex justify-center py-4">
                  <div className="h-8 w-8 animate-pulse rounded-full border-2 border-black/10 border-t-foreground/40 dark:border-white/10 dark:border-t-white/50" />
                </div>
              )}
              {!hasMore && lawyers.length > 12 && (
                <p className="py-2 text-center text-[12px] text-muted-foreground">
                  All advocates loaded
                </p>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="appointments" className="mt-4 space-y-4">
          {!appointmentsLoading && (
            <>
              <ConsultationsHero appointments={appointments} embedded />
              <ConsultationFilters
                search={aptSearch}
                onSearch={setAptSearch}
                status={aptStatus}
                onStatus={setAptStatus}
                date={aptDate}
                onDate={setAptDate}
                total={appointments.length}
                filtered={filteredAppointments.length}
              />
            </>
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
