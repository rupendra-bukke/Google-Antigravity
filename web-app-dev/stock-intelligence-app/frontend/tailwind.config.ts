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
                bb: {
                    orange: "#2962ff",
                    green: "#089981",
                    red: "#f23645",
                    amber: "#c48a2a",
                },
                terminal: {
                    bg: "#131722",
                    panel: "#1e222d",
                    border: "#2a2e39",
                    text: "#d1d4dc",
                    muted: "#868993",
                    dim: "#5d606b",
                },
                brand: {
                    400: "#5b8def",
                    500: "#2962ff",
                },
            },
            fontFamily: {
                sans: ["Inter", "system-ui", "sans-serif"],
                mono: ["IBM Plex Mono", "Courier New", "monospace"],
            },
            animation: {
                "fade-in": "fadeIn 0.2s ease-out",
            },
            keyframes: {
                fadeIn: {
                    "0%": { opacity: "0" },
                    "100%": { opacity: "1" },
                },
            },
        },
    },
    plugins: [],
};

export default config;
