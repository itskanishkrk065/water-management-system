import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

export function formatLitres(litres: number | string | null | undefined): string {
  if (litres === null || litres === undefined || isNaN(Number(litres))) return "0 L";
  return `${new Intl.NumberFormat("en-IN").format(Math.round(Number(litres)))} L`;
}

export function formatAcres(acres: number | string | null | undefined): string {
  if (acres === null || acres === undefined || isNaN(Number(acres))) return "0.00 acres";
  return `${Number(acres).toFixed(2)} acres`;
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "ACTIVE":
    case "APPROVED":
    case "PAID":
    case "COMMISSIONED":
    case "COMPLETED":
      return "bg-emerald-100 text-emerald-800 border-emerald-300";
    case "SUBMITTED":
    case "PENDING":
    case "REQUESTED":
    case "PLANNED":
      return "bg-amber-100 text-amber-800 border-amber-300";
    case "PARTIALLY_PAID":
    case "UNDER_REVIEW":
    case "UNDER_CONSTRUCTION":
      return "bg-sky-100 text-sky-800 border-sky-300";
    case "REJECTED":
    case "CANCELLED":
    case "OVERDUE":
    case "INACTIVE":
    case "REVERSED":
      return "bg-rose-100 text-rose-800 border-rose-300";
    default:
      return "bg-slate-100 text-slate-800 border-slate-300";
  }
}
