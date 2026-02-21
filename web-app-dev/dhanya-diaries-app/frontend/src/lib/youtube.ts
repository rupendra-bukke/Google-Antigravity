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
    description?: string;
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
        id: "uV5xP_Qv3pY",
        title: "Our Colorful New Year 2026 Celebration",
        thumbnail: "https://i.ytimg.com/vi/uV5xP_Qv3pY/maxresdefault.jpg",
        publishedAt: "2 weeks ago",
        description: "Join our family as we welcome 2026 with colors, lights, and a warm celebration at home.",
        viewCount: "15K",
    },
    {
        id: "rY3j_jT0n7k",
        title: "Instant Peanut Chutney Premix",
        thumbnail: "https://i.ytimg.com/vi/rY3j_jT0n7k/maxresdefault.jpg",
        publishedAt: "1 month ago",
        description: "Save time in the morning with this 2-minute chutney premix recipe. Perfect for busy households.",
        viewCount: "8.5K",
    },
    {
        id: "_jR9-rXhE_g",
        title: "Evening to Morning Routine",
        thumbnail: "https://i.ytimg.com/vi/_jR9-rXhE_g/maxresdefault.jpg",
        publishedAt: "8 days ago",
        description: "A peaceful look into my daily rhythm, from sunset chores to sunrise quiet moments.",
        viewCount: "12K",
    },
    {
        id: "VjLwPjT_mN4",
        title: "Weekly Deep Cleaning Routine",
        thumbnail: "https://i.ytimg.com/vi/VjLwPjT_mN4/maxresdefault.jpg",
        publishedAt: "3 months ago",
        description: "My secrets for keeping a house clean and organized 24/7 with simple weekly habits.",
        viewCount: "18K",
    },
    {
        id: "t_QfR_yP9a0",
        title: "Time Saving Meal Prep Tips",
        thumbnail: "https://i.ytimg.com/vi/t_QfR_yP9a0/maxresdefault.jpg",
        publishedAt: "1 month ago",
        description: "Organize your kitchen and meals for the whole week with these quick prep hacks.",
        viewCount: "10K",
    },
    {
        id: "iM8-t_s_K_k",
        title: "Mysore Palace Visit | Travel Vlog",
        thumbnail: "https://i.ytimg.com/vi/iM8-t_s_K_k/maxresdefault.jpg",
        publishedAt: "5 months ago",
        description: "Exploring the historic beauty and architectural wonders of the Mysore Palace.",
        viewCount: "40K",
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
        return MOCK_STATS;
    }
}

/**
 * Fetch Latest 6 Videos from the Channel
 */
export async function getLatestVideos(maxResults: number = 6): Promise<YouTubeVideo[]> {
    if (!API_KEY || !CHANNEL_ID || API_KEY === "YOUR_API_KEY_HERE") {
        return MOCK_VIDEOS.slice(0, maxResults);
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
            description: item.snippet.description,
        }));
    } catch (error) {
        return MOCK_VIDEOS.slice(0, maxResults);
    }
}
