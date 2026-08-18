import type { Config } from "tailwindcss";
import tailwindAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        "orb-pulse": {
          "0%, 100%": {
            boxShadow:
              "0 0 20px rgba(139, 92, 246, 0.4), 0 0 40px rgba(59, 130, 246, 0.2)",
            transform: "scale(1)",
          },
          "50%": {
            boxShadow:
              "0 0 30px rgba(139, 92, 246, 0.6), 0 0 60px rgba(59, 130, 246, 0.35)",
            transform: "scale(1.03)",
          },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        wave: {
          "0%, 100%": { transform: "translateX(0) scaleY(1)" },
          "50%": { transform: "translateX(-2%) scaleY(1.05)" },
        },
      },
      animation: {
        shimmer: "shimmer 2s ease-in-out infinite",
        "orb-pulse": "orb-pulse 2.5s ease-in-out infinite",
        float: "float 4s ease-in-out infinite",
        wave: "wave 3s ease-in-out infinite",
      },
    },
  },
  plugins: [tailwindAnimate],
};

export default config;
