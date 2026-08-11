export function AuthDivider() {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-black/[0.08] dark:border-white/10" />
      </div>
      <div className="relative flex justify-center text-xs uppercase tracking-wider">
        <span className="bg-white/80 px-3 text-muted-foreground dark:bg-zinc-950/80">
          or continue with email
        </span>
      </div>
    </div>
  );
}
