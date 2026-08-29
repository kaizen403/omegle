"use client";

interface EmptyStatesProps {
  loading: boolean;
  hasUsers: boolean;
  hasFilteredUsers: boolean;
  searchName: string;
  onClearSearch: () => void;
}

export function EmptyStates({
  loading,
  hasUsers,
  hasFilteredUsers,
  searchName,
  onClearSearch,
}: EmptyStatesProps) {
  if (loading) {
    return (
      <div className="p-8 sm:p-16 text-center">
        <div className="inline-block animate-spin rounded-full h-10 sm:h-12 w-10 sm:w-12 border-4 border-sky-200 border-t-blue-500"></div>
        <p className="text-slate-500 text-sm sm:text-base mt-3 sm:mt-4">
          Loading users...
        </p>
      </div>
    );
  }

  if (!hasUsers) {
    return (
      <div className="p-8 sm:p-16 text-center">
        <div className="text-6xl mb-4">🔍</div>
        <p className="text-slate-500 text-lg">No users found for this date</p>
      </div>
    );
  }

  if (!hasFilteredUsers) {
    return (
      <div className="p-16 text-center">
        <div className="text-6xl mb-4">🔍</div>
        <p className="text-slate-500 text-lg">
          No users found matching &quot;{searchName}&quot;
        </p>
        <button
          onClick={onClearSearch}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Clear Search
        </button>
      </div>
    );
  }

  return null;
}
