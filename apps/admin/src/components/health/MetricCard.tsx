import { motion } from "framer-motion";

interface MetricCardProps {
  title: string;
  value: string | number;
  status?: "healthy" | "warning" | "error";
  subtitle?: string;
  icon?: string;
}

export default function MetricCard({
  title,
  value,
  status,
  subtitle,
  icon,
}: MetricCardProps) {
  const statusColors = {
    healthy: "border-green-200 bg-gradient-to-br from-green-50 to-white",
    warning: "border-amber-200 bg-gradient-to-br from-amber-50 to-white",
    error: "border-red-200 bg-gradient-to-br from-red-50 to-white",
  };

  const statusDotColors = {
    healthy: "bg-green-500",
    warning: "bg-yellow-500",
    error: "bg-red-500",
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`border rounded-lg p-4 ${status ? statusColors[status] : "border-sky-100 bg-gradient-to-br from-white to-sky-50"}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {status && (
            <div
              className={`w-2 h-2 rounded-full ${statusDotColors[status]} animate-pulse`}
            />
          )}
          <div className="text-slate-500 text-xs uppercase tracking-wide">
            {title}
          </div>
        </div>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <div className="text-xl font-bold text-slate-900 mb-1">{value}</div>
      {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
    </motion.div>
  );
}
