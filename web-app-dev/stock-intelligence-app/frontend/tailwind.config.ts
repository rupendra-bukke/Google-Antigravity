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
                    orange: "#ff7700",
                    green: "#00c853",
                    red: "#ff1744",
                    amber: "#ffb300",
                },
                terminal: {
                    bg: "#000000",
                    panel: "#0a0a0a",
                    border: "#2a2a2a",
                    text: "#e8e8e8",
                    muted: "#8a8a8a",
                    dim: "#5c5c5c",
                },
                brand: {
                    400: "#ff9933",
                    500: "#ff7700",
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
