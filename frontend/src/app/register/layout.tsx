import { pageMetadata } from "@/lib/site-metadata";

export const metadata = pageMetadata({
  title: "Create Account",
  description: "Join MeraBakil — India's legal AI platform. Choose your role and start with Saarthi, research, and more.",
  path: "/register",
  noIndex: true,
});

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
