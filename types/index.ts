export interface Article {
  id: string;
  title: string;
  summary: string;
  body: string;
  image: string;
  author: {
    id: string;
    name: string;
    avatar: string;
  };
  category: string;
  createdAt: string;
  isRead: boolean;
}
