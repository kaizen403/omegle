/**
 * User Details Drawer Component
 * Displays detailed user information in a bottom drawer
 */

"use client";

import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
        className="h-[85vh] bg-white border-t border-sky-200 overflow-y-auto"
      >
        {user && (
          <SheetHeader className="border-b border-sky-200 pb-6 mb-6">
            <div className="flex items-center gap-4 w-full">
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center text-4xl ${
                  user.gender.toLowerCase() === "male"
                    ? "bg-blue-500/20"
                    : user.gender.toLowerCase() === "female"
                      ? "bg-pink-500/20"
                      : "bg-purple-500/20"
                }`}
              >
                {user.gender.toLowerCase() === "male"
                  ? "👨"
                  : user.gender.toLowerCase() === "female"
                    ? "👩"
                    : "🧑"}
              </div>
              <div>
                <SheetTitle className="text-2xl font-bold text-slate-900">
                  {user.name}
                </SheetTitle>
                <p className="text-slate-500">UID: {user.uid}</p>
              </div>
            </div>
          </SheetHeader>
        )}

        <div className="px-6">
          {loading ? (
            <div className="py-16 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-sky-200 border-t-blue-500"></div>
              <p className="text-slate-500 mt-4">Loading details...</p>
            </div>
          ) : user ? (
            <div className="space-y-6">
              {/* Location Map - First for immediate visibility */}
              {user.location?.latitude && user.location?.longitude && (
                <LocationMapView
                  latitude={user.location.latitude}
                  longitude={user.location.longitude}
                  city={user.location.city}
                  country={user.location.country?.name}
                />
              )}

              {/* Basic Info */}
              <BasicInfoSection user={user} formatTimestamp={formatTimestamp} />

              {/* Detailed Location Info */}
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

// Sub-components for better organization

function BasicInfoSection({
  user,
  formatTimestamp,
}: {
  user: UserVisit;
  formatTimestamp: (timestamp: number) => string;
}) {
  return (
    <div className="bg-sky-50 rounded-lg p-5">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <span className="text-xl">📋</span>
        Basic Information
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <div className="text-slate-500 text-sm mb-1">Gender</div>
          <span
            className={`inline-block px-3 py-1 rounded font-semibold ${
              user.gender.toLowerCase() === "male"
                ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                : user.gender.toLowerCase() === "female"
                  ? "bg-pink-500/20 text-pink-300 border border-pink-500/30"
                  : "bg-purple-500/20 text-purple-300 border border-purple-500/30"
            }`}
          >
            {user.gender}
          </span>
        </div>
        <div>
          <div className="text-slate-500 text-sm mb-1">Timestamp</div>
          <div className="text-slate-800 font-mono text-sm">
            {formatTimestamp(user.timestamp)}
          </div>
        </div>
        <div>
          <div className="text-slate-500 text-sm mb-1">IP Address</div>
          <div className="text-slate-800 font-mono text-sm break-all">
            {user.ipAddress || "N/A"}
          </div>
        </div>
      </div>
    </div>
  );
}

function LocationSummarySection({ location }: { location: LocationData }) {
  return (
    <div className="bg-sky-50 rounded-lg p-5">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <span className="text-xl">🌍</span>
        Location Summary
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {location.city && <InfoCard title="City" value={location.city} />}
        {location.principalSubdivision && (
          <InfoCard
            title="State/Province"
            value={location.principalSubdivision}
          />
        )}
        {location.country?.name && (
          <InfoCard
            title="Country"
            value={
              <span className="flex items-center gap-2">
                {location.country.countryFlagEmoji}
                {location.country.name}
              </span>
            }
          />
        )}
        {location.continent && (
          <InfoCard title="Continent" value={location.continent} />
        )}
        {location.postcode && (
          <InfoCard title="Postal Code" value={location.postcode} />
        )}
        {location.plusCode && (
          <InfoCard title="Plus Code" value={location.plusCode} />
        )}
        {location.timeZone?.displayName && (
          <div className="bg-white rounded-lg p-4 border border-sky-200 md:col-span-2 lg:col-span-3">
            <div className="text-slate-500 text-xs uppercase mb-1">
              Time Zone
            </div>
            <div className="text-slate-900 text-sm">
              {location.timeZone.displayName}
              {location.timeZone.localTime && (
                <span className="text-slate-500 ml-2">
                  (Local:{" "}
                  {new Date(location.timeZone.localTime).toLocaleString()})
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NetworkInfoSection({
  network,
}: {
  network?: LocationData["network"];
}) {
  if (!network) return null;

  return (
    <div className="bg-sky-50 rounded-lg p-5">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <span className="text-xl">🌐</span>
        Network Information
      </h3>
      <div className="space-y-3">
        {network.organisation && (
          <div className="bg-white rounded-lg p-3 border border-sky-200">
            <div className="text-slate-500 text-xs uppercase mb-1">
              ISP/Organization
            </div>
            <div className="text-slate-900 font-medium">
              {network.organisation}
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {network.bgpPrefix && (
            <div className="bg-white rounded-lg p-3 border border-sky-200">
              <div className="text-slate-500 text-xs uppercase mb-1">
                BGP Prefix
              </div>
              <div className="text-slate-900 font-mono text-xs break-all">
                {network.bgpPrefix}
              </div>
            </div>
          )}
          {network.registry && (
            <InfoCard title="Registry" value={network.registry} />
          )}
          {network.totalAddresses && (
            <InfoCard
              title="Total Addresses"
              value={network.totalAddresses.toLocaleString()}
            />
          )}
        </div>
        {network.carriers && network.carriers.length > 0 && (
          <div className="bg-white rounded-lg p-3 border border-sky-200">
            <div className="text-slate-500 text-xs uppercase mb-2">Carriers</div>
            <div className="space-y-2">
              {network.carriers.map((carrier, idx: number) => (
                <div key={idx} className="text-sm text-slate-800">
                  <span className="font-semibold">{carrier.name}</span>
                  <span className="text-slate-500 ml-2">({carrier.asn})</span>
                  {carrier.rankText && (
                    <span className="text-slate-500 ml-2 text-xs">
                      {carrier.rankText}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AdministrativeHierarchySection({
  administrative,
}: {
  administrative?: NonNullable<LocationData["localityInfo"]>["administrative"];
}) {
  if (!administrative || administrative.length === 0) return null;

  return (
    <div className="bg-sky-50 rounded-lg p-5">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <span className="text-xl">🏛️</span>
        Administrative Hierarchy
      </h3>
      <div className="space-y-2">
        {administrative.map((admin, idx: number) => (
          <div
            key={idx}
            className="bg-white rounded-lg p-3 border border-sky-200 flex items-start gap-3"
          >
            <div className="bg-blue-600/20 text-blue-400 px-2 py-1 rounded text-xs font-semibold shrink-0">
              Level {admin.adminLevel}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-slate-900 font-semibold">{admin.name}</div>
              {admin.description && (
                <div className="text-slate-500 text-xs mt-1">
                  {admin.description}
                </div>
              )}
              {admin.isoCode && (
                <div className="text-slate-500 text-xs mt-1">
                  Code: {admin.isoCode}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CountryDetailsSection({
  country,
}: {
  country?: LocationData["country"];
}) {
  if (!country) return null;

  return (
    <div className="bg-sky-50 rounded-lg p-5">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <span className="text-xl">{country.countryFlagEmoji || "🏴"}</span>
        Country Details
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {country.isoNameFull && (
          <div className="bg-white rounded-lg p-3 border border-sky-200 md:col-span-2">
            <div className="text-slate-500 text-xs uppercase mb-1">
              Full Name
            </div>
            <div className="text-slate-900 text-sm">{country.isoNameFull}</div>
          </div>
        )}
        {country.isoAlpha2 && (
          <InfoCard
            title="ISO Code"
            value={`${country.isoAlpha2} / ${country.isoAlpha3}`}
            mono
          />
        )}
        {country.callingCode && (
          <InfoCard
            title="Calling Code"
            value={`+${country.callingCode}`}
            mono
          />
        )}
        {country.currency && (
          <InfoCard
            title="Currency"
            value={`${country.currency.name} (${country.currency.code})`}
          />
        )}
        {country.wbIncomeLevel?.value && (
          <InfoCard title="Income Level" value={country.wbIncomeLevel.value} />
        )}
        {country.isoAdminLanguages && country.isoAdminLanguages.length > 0 && (
          <div className="bg-white rounded-lg p-3 border border-sky-200 md:col-span-2">
            <div className="text-slate-500 text-xs uppercase mb-1">
              Official Languages
            </div>
            <div className="text-slate-900 text-sm">
              {country.isoAdminLanguages.map((lang) => lang.isoName).join(", ")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RawDataSection({ location }: { location: LocationData }) {
  return (
    <div className="bg-sky-50 rounded-lg p-5">
      <details className="group">
        <summary className="text-lg font-semibold mb-2 flex items-center gap-2 cursor-pointer hover:text-blue-400 transition-colors">
          <span className="text-xl">🔍</span>
          Raw Location Data
          <span className="text-xs text-slate-500 ml-auto group-open:rotate-180 transition-transform">
            ▼
          </span>
        </summary>
        <pre className="mt-4 text-xs overflow-x-auto bg-[#e8f4f8] p-4 rounded border border-sky-200 text-slate-600 max-h-96 overflow-y-auto">
          {JSON.stringify(location, null, 2)}
        </pre>
      </details>
    </div>
  );
}

// Reusable Info Card Component
function InfoCard({
  title,
  value,
  mono = false,
}: {
  title: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="bg-white rounded-lg p-4 border border-sky-200">
      <div className="text-slate-500 text-xs uppercase mb-1">{title}</div>
      <div
        className={`text-slate-900 text-sm ${mono ? "font-mono" : "font-medium"}`}
      >
        {value}
      </div>
    </div>
  );
}
