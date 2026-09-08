export default function ProtectedLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-primary/25 border-t-primary"
        aria-label="Loading"
      />
    </div>
  );
}
