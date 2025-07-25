import type { Config } from "tailwindcss"

const config = {
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
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
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
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
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
        "hover-card-show": {
          "0%": {
            opacity: "0",
            transform: "translateY(5px)"
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)"
          }
        },
        "hover-card-hide": {
          "0%": {
            opacity: "1",
            transform: "translateY(0)"
          },
          "100%": {
            opacity: "0",
            transform: "translateY(5px)"
          }
        },
        "dropdown-in": {
          "0%": {
            opacity: "0",
            transform: "scale(0.95) translateY(-2px)"
          },
          "100%": {
            opacity: "1",
            transform: "scale(1) translateY(0)"
          }
        },
        "dropdown-out": {
          "0%": {
            opacity: "1",
            transform: "scale(1) translateY(0)"
          },
          "100%": {
            opacity: "0",
            transform: "scale(0.95) translateY(-2px)"
          }
        }
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "hover-card-show": "hover-card-show 0.3s ease-out",
        "hover-card-hide": "hover-card-hide 0.3s ease-out",
        "dropdown-in": "dropdown-in 0.2s ease-out",
        "dropdown-out": "dropdown-out 0.15s ease-in"
      },
    },
  },
  plugins: [],
} satisfies Config

export default config
