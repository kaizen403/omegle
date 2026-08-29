"use client";

export function UsersTableHeader() {
  return (
    <div className="grid grid-cols-[50px_minmax(180px,1fr)_130px_90px_220px_180px_140px] gap-2 py-3 bg-[#e8f4f8] border-b border-sky-100">
      <div className="text-xs font-semibold text-slate-500 uppercase">#</div>
      <div className="text-xs font-semibold text-slate-500 uppercase">USER</div>
      <div className="text-xs font-semibold text-slate-500 uppercase">UID</div>
      <div className="text-xs font-semibold text-slate-500 uppercase">
        GENDER
      </div>
      <div className="text-xs font-semibold text-slate-500 uppercase">TIME</div>
      <div className="text-xs font-semibold text-slate-500 uppercase">
        LOCATION
      </div>
      <div className="text-xs font-semibold text-slate-500 uppercase text-center">
        ACTIONS
      </div>
    </div>
  );
}
