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
