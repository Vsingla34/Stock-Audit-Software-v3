import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // ── Electric Violet — the real primary, vivid not muted ──────────
        violet: {
          50:  "#F5F1FF",
          100: "#EBE3FF",
          200: "#D6C6FF",
          300: "#B899FF",
          400: "#9A66FF",
          500: "#8338FF",   // vivid
          600: "#6E1FEB",   // ← PRIMARY
          700: "#5A17C4",
          800: "#47139C",
          900: "#360F78",
          950: "#1F0850",
        },
        // Secondary accent — magenta/pink, used sparingly for gradient pairs
        magenta: {
          400: "#F056C4",
          500: "#E63DB0",
          600: "#D0219A",
        },
        // Deep space neutrals — cooler and darker than generic slate
        space: {
          50:  "#F7F7FB",
          100: "#ECECF5",
          200: "#D8D8E6",
          300: "#ABABC7",
          400: "#7B7B9E",
          500: "#54547A",
          600: "#3D3D5C",
          700: "#2A2A45",
          800: "#191930",
          900: "#0D0D20",
          950: "#060612",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      backgroundImage: {
        "gradient-primary": "linear-gradient(135deg, #8338FF 0%, #6E1FEB 50%, #D0219A 100%)",
        "gradient-space":   "linear-gradient(180deg, #0D0D20 0%, #060612 100%)",
        "gradient-radial-violet": "radial-gradient(circle, rgba(131,56,255,0.35) 0%, transparent 70%)",
        "gradient-radial-magenta": "radial-gradient(circle, rgba(208,33,154,0.25) 0%, transparent 70%)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.04)",
        sm: "0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
        md: "0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)",
        lg: "0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.06)",
        glow: "0 0 24px rgba(131, 56, 255, 0.45), 0 4px 12px rgba(0,0,0,0.25)",
        "glow-sm": "0 0 12px rgba(131, 56, 255, 0.35)",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up":   { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        "fade-in-up":     { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-8px)" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.6" },
        },
        "shimmer": {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
        "fade-in-up":     "fade-in-up 0.3s ease-out both",
        "float":          "float 6s ease-in-out infinite",
        "pulse-glow":     "pulse-glow 2.5s ease-in-out infinite",
        "shimmer":        "shimmer 2.5s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;