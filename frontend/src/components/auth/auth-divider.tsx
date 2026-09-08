export function AuthDivider() {
  return (
    <div className="relative my-4">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-black/[0.08] dark:border-white/10" />
      </div>
      <div className="relative flex justify-center text-[11px] uppercase tracking-[0.14em]">
        <span className="bg-white px-2.5 text-muted-foreground dark:bg-zinc-900">
          or email
        </span>
      </div>
    </div>
  );
}
