export const statusMeta = {
  verified: {
    label: "已核验",
    icon: "✓",
    badge: "bg-teal-50 text-teal-700 ring-1 ring-[#cfe4de]",
    soft: "bg-teal-50 text-teal-700",
  },
  failed: {
    label: "核验失败",
    icon: "!",
    badge: "bg-rose-50 text-rose-700 ring-1 ring-[#ead6da]",
    soft: "bg-rose-50 text-rose-700",
  },
  pending: {
    label: "等待回执",
    icon: "◷",
    badge: "bg-amber-50 text-amber-700 ring-1 ring-[#eadfc7]",
    soft: "bg-amber-50 text-amber-700",
  },
  unsupported: {
    label: "链路不可达",
    icon: "◇",
    badge: "bg-slate-100 text-slate-600 ring-1 ring-[#dfe8e2]",
    soft: "bg-slate-100 text-slate-600",
  },
};

export function getStatusMeta(status) {
  return statusMeta[status] || statusMeta.pending;
}
