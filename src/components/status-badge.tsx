import { getStatusLabel, type CompletenessStatus } from "@/lib/house-status";

export function StatusBadge({ status }: { status: CompletenessStatus }) {
  const complete = status === "complete";
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
        complete
          ? "bg-green-100 text-green-800"
          : "bg-orange-100 text-orange-800"
      }`}
    >
      <span
        className={`mr-1.5 h-2 w-2 rounded-full ${complete ? "bg-green-600" : "bg-orange-500"}`}
      />
      {getStatusLabel(status)}
    </span>
  );
}
