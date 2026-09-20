import { SITE } from "@/lib/site-metadata";

export function getOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.name,
    url: SITE.url,
    logo: `${SITE.url}/brand/og-default.png`,
    description: SITE.description,
    sameAs: [`https://twitter.com/merabakil`],
    address: {
      "@type": "PostalAddress",
      addressCountry: "IN",
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      url: SITE.url,
    },
  };
}

export function getFAQPageSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is MeraBakil?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "MeraBakil is India's legal AI platform that connects citizens with relevant lawyers and provides AI-powered legal guidance through Saarthi, our AI legal assistant.",
        },
      },
      {
        "@type": "Question",
        name: "How does Saarthi work?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Saarthi is an AI legal assistant that answers your legal questions in plain language, providing answers grounded in Indian law with citations.",
        },
      },
      {
        "@type": "Question",
        name: "How do I find an advocate on MeraBakil?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "You can use our advocate marketplace to search and filter lawyers by practice area, experience, location, and availability. You can also use AI matching to get personalized recommendations.",
        },
      },
      {
        "@type": "Question",
        name: "Is my information secure?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, we follow strict data protection guidelines and comply with Indian privacy laws. Your personal information is encrypted and never shared without your consent.",
        },
      },
    ],
  };
}

export function getBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE.url}${item.url}`,
    })),
  };
}

export function getSoftwareApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Saarthi — AI Legal Assistant",
    description: "Ask legal questions in plain language. Get cited answers grounded in Indian law from MeraBakil's Saarthi AI assistant.",
    applicationCategory: "LegalApplication",
    operatingSystem: "Web",
    url: `${SITE.url}/mera-vakil`,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "INR",
    },
  };
}
