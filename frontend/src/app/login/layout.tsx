import { pageMetadata } from "@/lib/site-metadata";

export const metadata = pageMetadata({
  title: "Sign In",
  description: "Sign in to your MeraBakil account to access Saarthi, research, documents, and the advocate marketplace.",
  path: "/login",
  noIndex: true,
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
