export interface Article {
  id: string;
  title: string;
  summary: string;
  body: string;
  image: string;
  // Optional rich media
  images?: string[];
  videoUrl?: string;
  author: {
    id?: string; // optional; not required in sample data
    name: string;
    avatar: string;
  };
  // Publisher/brand (optional)
  publisherName?: string;
  publisherLogo?: string;
  category: string;
  createdAt: string;
  isRead: boolean;
  // Engagement fields used in UI
  likes?: number;
  dislikes?: number;
  comments?: number;
  // Optional metadata used by sample data
  language?: string;
  tags?: string[];
  // SEO / canonical metadata
  canonicalUrl?: string;
  metaTitle?: string;
  metaDescription?: string;
}

// Ad item for mixed feed
export interface AdItem {
  id: string;
  title?: string;
  mediaType?: string; // 'IMAGE' | 'VIDEO' | others
  mediaUrls: string[]; // support single or multiple
  posterUrl?: string;
  clickUrl?: string;
  languageId?: string;
}

export type FeedItem =
  | { type: 'news'; article: Article }
  | { type: 'ad'; ad: AdItem };
