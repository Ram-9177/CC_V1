/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    // Modernized rounded scale for better visual hierarchy and touch affordance
    borderRadius: {
      none: "0px",
      sm: "0.375rem",
      md: "0.5rem",
      lg: "0.75rem",
      xl: "1rem",
      "2xl": "1.25rem",
      "3xl": "1.5rem",
      full: "9999px",
      DEFAULT: "0.75rem",
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Outfit", "Plus Jakarta Sans", "ui-sans-serif", "system-ui", "sans-serif"],
      },
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
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "slide-in-from-bottom": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shake: {
          "0%, 100%": { transform: "rotate(0deg)" },
          "20%": { transform: "rotate(-10deg)" },
          "40%": { transform: "rotate(10deg)" },
          "60%": { transform: "rotate(-6deg)" },
          "80%": { transform: "rotate(6deg)" },
        },
        spin: {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "var(--fade-in-transform, translateY(8px))" },
          "100%": { opacity: "1", transform: "translateY(0) translateX(0)" },
        },
        slide: {
          "0%": { transform: "translateX(-100%)" },
          "50%": { transform: "translateX(200%)" },
          "100%": { transform: "translateX(-100%)" },
        },
        /* Decorative only — subtle “living” illustration feel (respect reduced motion in CSS) */
        "illus-drift": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)", opacity: "0.55" },
          "50%": { transform: "translate(2%, -1.5%) scale(1.04)", opacity: "0.75" },
        },
        "illus-drift-slow": {
          "0%, 100%": { transform: "translate(0, 0)", opacity: "0.35" },
          "50%": { transform: "translate(-3%, 2%)", opacity: "0.5" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "slide-in-from-bottom":
          "slide-in-from-bottom 0.55s cubic-bezier(0.16, 1, 0.3, 1) both",
        shake: "shake 650ms cubic-bezier(0.36, 0.07, 0.19, 0.97) both",
        "spin-slow": "spin 3s linear infinite",
        "fade-in-up": "fadeInUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) both",
        slide: "slide 1.5s ease-in-out infinite",
        "illus-drift": "illus-drift 22s ease-in-out infinite",
        "illus-drift-slow": "illus-drift-slow 28s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
