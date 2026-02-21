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

// ── MOCK DATA FOR THEME PREVIEW ──
const MOCK_VIDEOS: YouTubeVideo[] = [
    {
        id: "v1",
        title: "How to organize your small kitchen for maximum space | Kitchen Hacks",
        thumbnail: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80",
        publishedAt: "2 days ago",
        viewCount: "12K",
    },
    {
        id: "v2",
        title: "My Top 5 Secret Spices for Every Indian Household | Authentic Cooking",
        thumbnail: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80",
        publishedAt: "1 week ago",
        viewCount: "8.5K",
    },
    {
        id: "v3",
        title: "Simple morning routine for a productive and peaceful day | Calm Living",
        thumbnail: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80",
        publishedAt: "2 weeks ago",
        viewCount: "15K",
    }
];

const MOCK_STATS: ChannelStats = {
    subscriberCount: "25,400",
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
