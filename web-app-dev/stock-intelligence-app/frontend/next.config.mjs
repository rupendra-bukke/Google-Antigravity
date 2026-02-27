/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
        // BACKEND_URL is a server-side env var set in Vercel (not NEXT_PUBLIC_)
        // In dev: set in .env.local as BACKEND_URL=http://localhost:8000
        const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        return [
            {
                source: "/api/:path*",
                destination: `${backendUrl}/api/:path*`,
            },
        ];
    },
};

export default nextConfig;
