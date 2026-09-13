import { pageMetadata } from "@/lib/site-metadata";

export const metadata = pageMetadata({
  title: "Forgot Password",
  description: "Reset your MeraBakil account password.",
  path: "/forgot-password",
  noIndex: true,
});

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
