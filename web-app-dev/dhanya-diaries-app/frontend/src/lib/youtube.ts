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
        id: "QqolkgvJgJo",
        title: "Evening to Morning Routine",
        thumbnail: "https://i.ytimg.com/vi/QqolkgvJgJo/hqdefault.jpg",
        publishedAt: "8 days ago",
        description: "A peaceful look into my daily rhythm, from sunset chores to sunrise quiet moments.",
        viewCount: "32K",
    },
    {
        id: "uAST_xFaelc",
        title: "Village Cooking & KFC Secret",
        thumbnail: "https://i.ytimg.com/vi/uAST_xFaelc/hqdefault.jpg",
        publishedAt: "12 days ago",
        description: "Cooking an authentic village meal and sharing my KFC-style chicken secret.",
        viewCount: "25K",
    },
    {
        id: "_b9zIqA5IZA",
        title: "5am to 12pm Morning Routine",
        thumbnail: "https://i.ytimg.com/vi/_b9zIqA5IZA/hqdefault.jpg",
        publishedAt: "2 weeks ago",
        description: "Join me for a productive morning from 5am to noon, balancing housework and vlogging.",
        viewCount: "18K",
    },
    {
        id: "qaFEZEnq4Ds",
        title: "Pelletoori Ma Oori Gattula Meeda",
        thumbnail: "https://i.ytimg.com/vi/qaFEZEnq4Ds/hqdefault.jpg",
        publishedAt: "3 weeks ago",
        description: "A nostalgic visit to my village, exploring the beautiful landscapes and local traditions.",
        viewCount: "22K",
    },
    {
        id: "7KzN1K1S-tE",
        title: "24/7 House Cleaning Secrets",
        thumbnail: "https://i.ytimg.com/vi/7KzN1K1S-tE/hqdefault.jpg",
        publishedAt: "1 month ago",
        description: "My secrets for keeping a house clean and organized 24/7 with simple weekly habits.",
        viewCount: "45K",
    },
    {
        id: "U_f40b3w00I",
        title: "Time Saving Meal Prep Tips",
        thumbnail: "https://i.ytimg.com/vi/U_f40b3w00I/hqdefault.jpg",
        publishedAt: "1 month ago",
        description: "Organize your kitchen and meals for the whole week with these quick prep hacks.",
        viewCount: "15K",
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
