
import { Article } from '@/types';

const mockArticles: Article[] = [
  {
    id: '1',
    title: 'Breaking News: Something Happened',
    summary: 'A brief summary of the breaking news event.',
    body: 'This is the full body of the article. It contains all the details about the event that happened. It can be a long text.',
    image: 'https://picsum.photos/700',
    author: {
      id: 'author1',
      name: 'John Doe',
      avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
    },
    category: 'General',
    createdAt: new Date().toISOString(),
    isRead: false,
  },
  // ... other mock articles
];

export const getNews = async (lang: string): Promise<Article[]> => {
  console.log(`Fetching news for language: ${lang}`);
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  return mockArticles;
};

export const getArticleById = async (id: string): Promise<Article | undefined> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return mockArticles.find(article => article.id === id);
}

export const registerGuestUser = async (data: { languageId: string; deviceDetails: any }) => {
  console.log('Registering guest user with data:', data);
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  // Return a mock response
  return {
    jwt: 'mock-jwt-token',
    refreshToken: 'mock-refresh-token',
  };
};
