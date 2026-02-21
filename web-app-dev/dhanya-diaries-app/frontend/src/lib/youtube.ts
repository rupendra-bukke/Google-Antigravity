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
        id: "rC80c9PjM2o",
        title: "Our Colorful New Year 2026 Celebration",
        thumbnail: "https://i.ytimg.com/vi/rC80c9PjM2o/hqdefault.jpg",
        publishedAt: "2 weeks ago",
        description: "Join our family as we welcome 2026 with colors, lights, and a warm celebration at home.",
        viewCount: "25K",
    },
    {
        id: "l_u2wL-0G9g",
        title: "Instant Peanut Chutney Premix",
        thumbnail: "https://i.ytimg.com/vi/l_u2wL-0G9g/hqdefault.jpg",
        publishedAt: "1 month ago",
        description: "Save time in the morning with this 2-minute chutney premix recipe. Perfect for busy households.",
        viewCount: "18K",
    },
    {
        id: "l_XfC0IoxbM",
        title: "Evening to Morning Routine",
        thumbnail: "https://i.ytimg.com/vi/l_XfC0IoxbM/hqdefault.jpg",
        publishedAt: "8 days ago",
        description: "A peaceful look into my daily rhythm, from sunset chores to sunrise quiet moments.",
        viewCount: "32K",
    },
    {
        id: "VjLwPjT_mN4",
        title: "24/7 House Cleaning Secrets",
        thumbnail: "https://i.ytimg.com/vi/VjLwPjT_mN4/hqdefault.jpg",
        publishedAt: "3 weeks ago",
        description: "My secrets for keeping a house clean and organized 24/7 with simple weekly habits.",
        viewCount: "22K",
    },
    {
        id: "t_QfR_yP9a0",
        title: "Time Saving Meal Prep Tips",
        thumbnail: "https://i.ytimg.com/vi/t_QfR_yP9a0/hqdefault.jpg",
        publishedAt: "1 month ago",
        description: "Organize your kitchen and meals for the whole week with these quick prep hacks.",
        viewCount: "15K",
    },
    {
        id: "iM8-t_s_K_k",
        title: "Mysore Palace Visit | Travel Vlog",
        thumbnail: "https://i.ytimg.com/vi/iM8-t_s_K_k/hqdefault.jpg",
        publishedAt: "5 months ago",
        description: "Exploring the historic beauty and architectural wonders of the Mysore Palace.",
        viewCount: "45K",
    },
    {
        id: "sU1_uD2-sJc",
        title: "My Productive Weekend Vlog",
        thumbnail: "https://i.ytimg.com/vi/sU1_uD2-sJc/hqdefault.jpg",
        publishedAt: "1 month ago",
        description: "A full weekend spent balancing home projects, cooking, and family time.",
        viewCount: "12K",
    },
    {
        id: "A2d-lR4lV5g",
        title: "Simple Home Organization Hacks",
        thumbnail: "https://i.ytimg.com/vi/A2d-lR4lV5g/hqdefault.jpg",
        publishedAt: "2 months ago",
        description: "Small changes to your home layout that make daily life much smoother.",
        viewCount: "20K",
    },
    {
        id: "X_w0-d_eS_q",
        title: "My Special Masala Curry",
        thumbnail: "https://i.ytimg.com/vi/X_w0-d_eS_q/hqdefault.jpg",
        publishedAt: "4 months ago",
        description: "Sharing the recipe for my favorite aromatic and flavorful masala curry.",
        viewCount: "19K",
    },
    {
        id: "F_z1-g_Yp_i",
        title: "Village Life Experience",
        thumbnail: "https://i.ytimg.com/vi/F_z1-g_Yp_i/hqdefault.jpg",
        publishedAt: "6 months ago",
        description: "A serene journey into village life, cooking outdoors and enjoying nature.",
        viewCount: "50K",
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
