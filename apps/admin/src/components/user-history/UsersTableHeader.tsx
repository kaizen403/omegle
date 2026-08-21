"use client";

export function UsersTableHeader() {
  return (
    <div className="grid grid-cols-[50px_minmax(180px,1fr)_130px_90px_220px_180px_140px] gap-2 py-3 bg-zinc-950 border-b border-zinc-800">
      <div className="text-xs font-semibold text-zinc-400 uppercase">#</div>
      <div className="text-xs font-semibold text-zinc-400 uppercase">USER</div>
      <div className="text-xs font-semibold text-zinc-400 uppercase">UID</div>
      <div className="text-xs font-semibold text-zinc-400 uppercase">
        GENDER
      </div>
      <div className="text-xs font-semibold text-zinc-400 uppercase">TIME</div>
      <div className="text-xs font-semibold text-zinc-400 uppercase">
        LOCATION
      </div>
      <div className="text-xs font-semibold text-zinc-400 uppercase text-center">
        ACTIONS
      </div>
    </div>
  );
}
