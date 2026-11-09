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
                    orange: "#7c93ff",
                    green: "#3ddc97",
                    red: "#ff6b8a",
                    amber: "#f5c16c",
                },
                terminal: {
                    bg: "#070b14",
                    panel: "#121a2c",
                    border: "#2a3654",
                    text: "#eef2ff",
                    muted: "#9aa6c4",
                    dim: "#6d7896",
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
