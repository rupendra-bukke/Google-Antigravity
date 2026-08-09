import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                brand: {
                    50: "#eef2ff",
                    100: "#e0e7ff",
                    200: "#c7d2fe",
                    300: "#a5b4fc",
                    400: "#818cf8",
                    500: "#6366f1",
                    600: "#4f46e5",
                    700: "#4338ca",
                    800: "#3730a3",
                    900: "#312e81",
                    950: "#1e1b4b",
                },
                gold: {
                    50: "#fbf8ef",
                    100: "#f5ecd4",
                    200: "#ead9a8",
                    300: "#dfc67d",
                    400: "#d4af37",
                    500: "#b8942e",
                    600: "#967826",
                    700: "#745c1e",
                    800: "#524116",
                    900: "#30260e",
                },
                surface: {
                    950: "#06080f",
                    900: "#0c1019",
                    800: "#121826",
                    700: "#1a2234",
                    600: "#243044",
                },
            },
            fontFamily: {
                sans: ["Inter", "system-ui", "sans-serif"],
                display: ["Plus Jakarta Sans", "Inter", "system-ui", "sans-serif"],
            },
            boxShadow: {
                terminal: "0 4px 24px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
                "terminal-gold": "0 4px 28px rgba(212, 175, 55, 0.08), inset 0 1px 0 rgba(212, 175, 55, 0.12)",
            },
            animation: {
                "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                "fade-in": "fadeIn 0.45s ease-out",
                "slide-up": "slideUp 0.4s ease-out",
            },
            keyframes: {
                fadeIn: {
                    "0%": { opacity: "0" },
                    "100%": { opacity: "1" },
                },
                slideUp: {
                    "0%": { opacity: "0", transform: "translateY(10px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
            },
        },
    },
    plugins: [],
};

export default config;
