/**
 * Dhanya Diaries - YouTube Data Service
 * 
 * This service handles fetching live data from the YouTube Data API v3.
 * It includes a fallback mechanism to 'Mock Data' if API keys are not provided.
 */

const API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
const CHANNEL_ID = process.env.NEXT_PUBLIC_YOUTUBE_CHANNEL_ID;

export interface YouTubeVideo {
    id: string;
    title: string;
    thumbnail: string;
    publishedAt: string;
    viewCount?: string;
}

export interface ChannelStats {
    subscriberCount: string;
    videoCount: string;
    viewCount: string;
}

// ── REAL BACKUP DATA FOR AUTHENTIC FEEL ──
const MOCK_VIDEOS: YouTubeVideo[] = [
    {
        id: "rC80c9PjM2o",
        title: "Our Colorful New Year 2026 Celebration | Dhanya Diaries",
        thumbnail: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80",
        publishedAt: "2 weeks ago",
        viewCount: "15K",
    },
    {
        id: "l_u2wL-0G9g",
        title: "Instant Peanut Chutney Premix | Kitchen Hacks",
        thumbnail: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80",
        publishedAt: "1 month ago",
        viewCount: "8.5K",
    },
    {
        id: "l_XfC0IoxbM",
        title: "Evening to Morning Routine | Daily Motivation",
        thumbnail: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80",
        publishedAt: "8 days ago",
        viewCount: "12K",
    },
    {
        id: "_jR9-rXhE_g",
        title: "My Productive Evening Tasks | Housekeeping",
        thumbnail: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80",
        publishedAt: "2 months ago",
        viewCount: "20K",
    },
    {
        id: "VjLwPjT_mN4",
        title: "Weekly Deep Cleaning Routine | Motivation",
        thumbnail: "https://images.unsplash.com/photo-1581578731548-c64695cc6954?auto=format&fit=crop&w=800&q=80",
        publishedAt: "3 months ago",
        viewCount: "18K",
    },
    {
        id: "rY3j_jT0n7k",
        title: "Traditional Masala Curry | Cooking Secrets",
        thumbnail: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=800&q=80",
        publishedAt: "4 months ago",
        viewCount: "25K",
    },
    {
        id: "J-lT1-vV2hQ",
        title: "4 AM Mutton Biryani Story | Travel Food",
        thumbnail: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=800&q=80",
        publishedAt: "2 weeks ago",
        viewCount: "12K",
    },
    {
        id: "t_QfR_yP9a0",
        title: "Time Saving Meal Prep Tips | Kitchen Wisdom",
        thumbnail: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80",
        publishedAt: "1 month ago",
        viewCount: "10K",
    },
    {
        id: "iM8-t_s_K_k",
        title: "Mysore Palace Visit | Travel Vlog",
        thumbnail: "https://images.unsplash.com/photo-1624513101640-59a84ba86043?auto=format&fit=crop&w=800&q=80",
        publishedAt: "5 months ago",
        viewCount: "40K",
    },
    {
        id: "F_z1-g_Yp_i",
        title: "Village Life Experience | Quiet Living",
        thumbnail: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80",
        publishedAt: "6 months ago",
        viewCount: "35K",
    }
];

const MOCK_STATS: ChannelStats = {
    subscriberCount: "24,500",
    videoCount: "142",
    viewCount: "1.2M",
};

/**
 * Fetch Channel Statistics (Subscribers, Views, etc.)
 */
export async function getChannelStats(): Promise<ChannelStats> {
    if (!API_KEY || !CHANNEL_ID || API_KEY === "YOUR_API_KEY_HERE") {
        console.warn("YouTube API Key missing - Using Mock Stats");
        return MOCK_STATS;
    }

    try {
        const res = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${CHANNEL_ID}&key=${API_KEY}`
        );
        const data = await res.json();
        const stats = data.items[0].statistics;

        return {
            subscriberCount: parseInt(stats.subscriberCount).toLocaleString(),
            videoCount: stats.videoCount,
            viewCount: parseInt(stats.viewCount).toLocaleString(),
        };
    } catch (error) {
        console.error("YouTube Stats Fetch Error:", error);
        return MOCK_STATS;
    }
}

/**
 * Fetch Latest 6 Videos from the Channel
 */
export async function getLatestVideos(maxResults: number = 6): Promise<YouTubeVideo[]> {
    if (!API_KEY || !CHANNEL_ID || API_KEY === "YOUR_API_KEY_HERE") {
        console.warn("YouTube API Key missing - Using Mock Videos");
        return MOCK_VIDEOS;
    }

    try {
        const res = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${CHANNEL_ID}&maxResults=${maxResults}&order=date&type=video&key=${API_KEY}`
        );
        const data = await res.json();

        return data.items.map((item: any) => ({
            id: item.id.videoId,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails.high.url,
            publishedAt: new Date(item.snippet.publishedAt).toLocaleDateString(),
        }));
    } catch (error) {
        console.error("YouTube Videos Fetch Error:", error);
        return MOCK_VIDEOS;
    }
}
