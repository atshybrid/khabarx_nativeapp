export interface Article {
  id: string;
  title: string;
  summary: string;
  body: string;
  image: string;
  author: {
    id?: string; // optional; not required in sample data
    name: string;
    avatar: string;
  };
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
}
