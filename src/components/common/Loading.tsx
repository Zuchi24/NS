export function Loading({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-50">
      <div className="w-8 h-8 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}
