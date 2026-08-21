/**
 * Type definitions for User History page
 */

// Lightweight list item (returned from /api/admin/users/list/:date)
export interface UserListItem {
  uid: number;
  name: string;
  gender: string;
  timestamp: number;
  city?: string;
  country?: string;
}

// Location data structure
export interface LocationData {
  latitude?: number;
  longitude?: number;
  city?: string;
  principalSubdivision?: string;
  continent?: string;
  postcode?: string;
  plusCode?: string;
  country?: {
    name?: string;
    countryFlagEmoji?: string;
    isoNameFull?: string;
    isoAlpha2?: string;
    isoAlpha3?: string;
    callingCode?: string;
    currency?: {
      name: string;
      code: string;
    };
    wbIncomeLevel?: {
      value: string;
    };
    isoAdminLanguages?: Array<{
      isoName: string;
    }>;
  };
  network?: {
    organisation?: string;
    bgpPrefix?: string;
    registry?: string;
    totalAddresses?: number;
    carriers?: Array<{
      name: string;
      asn: string;
      rankText?: string;
    }>;
  };
  localityInfo?: {
    administrative?: Array<{
      name: string;
      description?: string;
      isoCode?: string;
      adminLevel: number;
    }>;
  };
  timeZone?: {
    displayName: string;
    localTime?: string;
  };
  [key: string]: unknown;
}

// Full user details (returned from /api/admin/users/details/:date/:uid)
export interface UserVisit {
  uid: number;
  name: string;
  gender: string;
  timestamp: number;
  ipAddress?: string;
  location?: LocationData;
}
