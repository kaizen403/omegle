/**
 * User Details Drawer Component
 * Displays detailed user information in a bottom drawer
 */

"use client";

import React from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { IdChip, MetricRow, StatusPill } from "@/components/console";
import { UserVisit, LocationData } from "@/types/user";
import LocationMapView from "./LocationMapView";

interface UserDetailsModalProps {
  user: UserVisit | null;
  loading: boolean;
  onClose: () => void;
}

export default function UserDetailsModal({
  user,
  loading,
  onClose,
}: UserDetailsModalProps) {
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <Sheet
      open={!!(user || loading)}
      onOpenChange={(open) => !open && onClose()}
    >
      <SheetContent
        side="bottom"
        className="flex h-[85vh] flex-col gap-0 border-t border-border bg-background p-0"
      >
        <SheetHeader className="shrink-0 gap-0 border-b border-border bg-card px-4 py-3 pr-12 sm:px-5">
          {user ? (
            <div className="min-w-0">
              <SheetTitle className="truncate text-base font-semibold">
                {user.name}
              </SheetTitle>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <IdChip value={user.uid} prefix="UID " />
                <StatusPill tone="neutral" className="capitalize">
                  {user.gender}
                </StatusPill>
              </div>
            </div>
          ) : (
            <SheetTitle className="text-base font-semibold">
              User details
            </SheetTitle>
          )}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2
                className="size-6 animate-spin text-muted-foreground"
                strokeWidth={2}
              />
              <p className="mt-3 text-sm text-muted-foreground">
                Loading details
              </p>
            </div>
          ) : user ? (
            <div className="mx-auto min-w-0 max-w-[1100px] space-y-4">
              {/* Location Map - First for immediate visibility */}
              {user.location?.latitude && user.location?.longitude && (
                <LocationMapView
                  latitude={user.location.latitude}
                  longitude={user.location.longitude}
                  city={user.location.city}
                  country={user.location.country?.name}
                />
              )}

              <BasicInfoSection user={user} formatTimestamp={formatTimestamp} />

              {user.location && (
                <>
                  <LocationSummarySection location={user.location} />
                  <NetworkInfoSection network={user.location.network} />
                  <AdministrativeHierarchySection
                    administrative={user.location.localityInfo?.administrative}
                  />
                  <CountryDetailsSection country={user.location.country} />
                  <RawDataSection location={user.location} />
                </>
              )}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------------- */
/* Layout helpers                                                            */
/* ------------------------------------------------------------------------- */

/** A labelled card. Facts inside it are MetricRows separated by hairlines. */
function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-border bg-card">
      <header className="border-b border-border px-4 py-3">
        <h3 className="min-w-0 truncate text-[0.9375rem] font-semibold text-foreground">
          {title}
        </h3>
      </header>
      <div className="min-w-0 px-4 py-1">{children}</div>
    </section>
  );
}

/** A MetricRow whose value can be long: it truncates and keeps a title. */
function Fact({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  const title = typeof value === "string" ? value : undefined;
  return (
    <MetricRow
      className="border-b border-border last:border-b-0"
      label={label}
      value={
        mono && typeof value === "string" ? (
          <IdChip value={value} prefix="" className="max-w-[20rem]" />
        ) : (
          <span
            className="block max-w-[20rem] truncate text-right"
            title={title}
          >
            {value}
          </span>
        )
      }
    />
  );
}

/* ------------------------------------------------------------------------- */
/* Sections                                                                  */
/* ------------------------------------------------------------------------- */

function BasicInfoSection({
  user,
  formatTimestamp,
}: {
  user: UserVisit;
  formatTimestamp: (timestamp: number) => string;
}) {
  return (
    <Group title="Basic information">
      <MetricRow
        className="border-b border-border"
        label="Gender"
        value={
          <StatusPill tone="neutral" className="capitalize">
            {user.gender}
          </StatusPill>
        }
      />
      <MetricRow
        className="border-b border-border"
        label="Seen at"
        value={
          <span className="tabular-nums">
            {formatTimestamp(user.timestamp)}
          </span>
        }
      />
      <MetricRow
        label="IP address"
        value={
          user.ipAddress ? (
            <IdChip value={user.ipAddress} prefix="" />
          ) : (
            <span className="text-muted-foreground">Not recorded</span>
          )
        }
      />
    </Group>
  );
}

function LocationSummarySection({ location }: { location: LocationData }) {
  const hasAny =
    location.city ||
    location.principalSubdivision ||
    location.country?.name ||
    location.continent ||
    location.postcode ||
    location.plusCode ||
    location.timeZone?.displayName;

  if (!hasAny) return null;

  return (
    <Group title="Location summary">
      {location.city && <Fact label="City" value={location.city} />}
      {location.principalSubdivision && (
        <Fact label="State or province" value={location.principalSubdivision} />
      )}
      {location.country?.name && (
        <Fact label="Country" value={location.country.name} />
      )}
      {location.continent && (
        <Fact label="Continent" value={location.continent} />
      )}
      {location.postcode && (
        <Fact label="Postal code" value={location.postcode} mono />
      )}
      {location.plusCode && (
        <Fact label="Plus code" value={location.plusCode} mono />
      )}
      {location.timeZone?.displayName && (
        <Fact
          label="Time zone"
          value={
            <span className="flex flex-wrap items-baseline justify-end gap-x-2">
              <span>{location.timeZone.displayName}</span>
              {location.timeZone.localTime && (
                <span className="text-xs font-normal text-muted-foreground tabular-nums">
                  local {new Date(location.timeZone.localTime).toLocaleString()}
                </span>
              )}
            </span>
          }
        />
      )}
    </Group>
  );
}

function NetworkInfoSection({
  network,
}: {
  network?: LocationData["network"];
}) {
  if (!network) return null;

  return (
    <Group title="Network">
      {network.organisation && (
        <Fact label="ISP or organisation" value={network.organisation} />
      )}
      {network.bgpPrefix && (
        <Fact label="BGP prefix" value={network.bgpPrefix} mono />
      )}
      {network.registry && <Fact label="Registry" value={network.registry} />}
      {network.totalAddresses !== undefined && (
        <Fact
          label="Total addresses"
          value={network.totalAddresses.toLocaleString()}
        />
      )}
      {network.carriers && network.carriers.length > 0 && (
        <div className="py-3">
          <p className="text-sm text-muted-foreground">Carriers</p>
          <ul className="mt-2 space-y-1.5">
            {network.carriers.map((carrier, idx: number) => (
              <li
                key={idx}
                className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm"
              >
                <span className="min-w-0 truncate font-medium text-foreground">
                  {carrier.name}
                </span>
                <IdChip value={carrier.asn} prefix="AS " />
                {carrier.rankText && (
                  <span className="text-xs text-muted-foreground">
                    {carrier.rankText}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Group>
  );
}

function AdministrativeHierarchySection({
  administrative,
}: {
  administrative?: NonNullable<LocationData["localityInfo"]>["administrative"];
}) {
  if (!administrative || administrative.length === 0) return null;

  return (
    <Group title="Administrative hierarchy">
      <ul className="divide-y divide-border">
        {administrative.map((admin, idx: number) => (
          <li key={idx} className="flex min-w-0 items-start gap-3 py-2.5">
            <StatusPill tone="neutral" className="mt-0.5">
              Level <span className="tabular-nums">{admin.adminLevel}</span>
            </StatusPill>
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-sm font-medium text-foreground"
                title={admin.name}
              >
                {admin.name}
              </p>
              {admin.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {admin.description}
                </p>
              )}
              {admin.isoCode && (
                <p className="mt-1">
                  <IdChip value={admin.isoCode} prefix="" />
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Group>
  );
}

function CountryDetailsSection({
  country,
}: {
  country?: LocationData["country"];
}) {
  if (!country) return null;

  return (
    <Group title="Country details">
      {country.isoNameFull && (
        <Fact label="Full name" value={country.isoNameFull} />
      )}
      {country.isoAlpha2 && (
        <Fact
          label="ISO code"
          value={`${country.isoAlpha2} / ${country.isoAlpha3}`}
          mono
        />
      )}
      {country.callingCode && (
        <Fact label="Calling code" value={`+${country.callingCode}`} mono />
      )}
      {country.currency && (
        <Fact
          label="Currency"
          value={`${country.currency.name} (${country.currency.code})`}
        />
      )}
      {country.wbIncomeLevel?.value && (
        <Fact label="Income level" value={country.wbIncomeLevel.value} />
      )}
      {country.isoAdminLanguages && country.isoAdminLanguages.length > 0 && (
        <Fact
          label="Official languages"
          value={country.isoAdminLanguages
            .map((lang) => lang.isoName)
            .join(", ")}
        />
      )}
    </Group>
  );
}

function RawDataSection({ location }: { location: LocationData }) {
  return (
    <section className="min-w-0 rounded-xl border border-border bg-card">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[0.9375rem] font-semibold text-foreground">
          <span className="min-w-0 truncate">Raw location data</span>
          <ChevronDown
            className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
            strokeWidth={2}
          />
        </summary>
        <div className="border-t border-border p-4">
          <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs leading-5 text-muted-foreground">
            {JSON.stringify(location, null, 2)}
          </pre>
        </div>
      </details>
    </section>
  );
}
