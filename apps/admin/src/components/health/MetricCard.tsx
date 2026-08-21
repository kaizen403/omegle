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
    healthy:
      "border-green-900/30 bg-gradient-to-br from-green-900/10 to-zinc-950",
    warning:
      "border-yellow-900/30 bg-gradient-to-br from-yellow-900/10 to-zinc-950",
    error: "border-red-900/30 bg-gradient-to-br from-red-900/10 to-zinc-950",
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
      className={`border rounded-lg p-4 ${status ? statusColors[status] : "border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950"}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {status && (
            <div
              className={`w-2 h-2 rounded-full ${statusDotColors[status]} animate-pulse`}
            />
          )}
          <div className="text-zinc-400 text-xs uppercase tracking-wide">
            {title}
          </div>
        </div>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <div className="text-xl font-bold text-white mb-1">{value}</div>
      {subtitle && <div className="text-xs text-zinc-500">{subtitle}</div>}
    </motion.div>
  );
}
