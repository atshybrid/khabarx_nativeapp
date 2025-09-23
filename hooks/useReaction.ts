import { computeNextReaction, getArticleReaction, updateArticleReaction } from '@/services/api';
import { useCallback, useEffect, useRef, useState } from 'react';

export type ReactionType = 'LIKE' | 'DISLIKE' | 'NONE';

interface ReactionState {
  reaction: ReactionType;
  likes: number;
  dislikes: number;
  loading: boolean;
  error: string | null;
  updating: boolean;
}

interface UseReactionOptions {
  articleId: string | undefined;
  // onAuthRequired kept for backward compatibility but no longer used (API is public)
  onAuthRequired?: () => void;
}

export function useReaction({ articleId, onAuthRequired }: UseReactionOptions) {
  const [state, setState] = useState<ReactionState>({
    reaction: 'NONE',
    likes: 0,
    dislikes: 0,
    loading: true,
    error: null,
    updating: false,
  });
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const load = useCallback(async () => {
    if (!articleId) return;
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const data = await getArticleReaction(articleId);
      if (!mountedRef.current) return;
      setState(s => ({
        ...s,
        loading: false,
        reaction: data.reaction,
        likes: data.counts?.likes || 0,
        dislikes: data.counts?.dislikes || 0,
      }));
    } catch (e: any) {
      if (!mountedRef.current) return;
      setState(s => ({ ...s, loading: false, error: e?.message || 'Failed to load reactions' }));
    }
  }, [articleId]);

  useEffect(() => { load(); }, [load]);

  const toggle = useCallback(async (wanted: 'LIKE' | 'DISLIKE') => {
    if (!articleId) return;
    // Public API: no auth gating – proceed optimistically regardless of user session
    setState(s => ({ ...s, error: null }));
    setState(s => {
      const nextReaction = computeNextReaction(s.reaction, wanted);
      // Optimistic count adjustments
      let { likes, dislikes } = s;
      // Remove previous
      if (s.reaction === 'LIKE') likes = Math.max(0, likes - 1);
      else if (s.reaction === 'DISLIKE') dislikes = Math.max(0, dislikes - 1);
      // Add new (unless NONE)
      if (nextReaction === 'LIKE') likes += 1; else if (nextReaction === 'DISLIKE') dislikes += 1;
      return { ...s, reaction: nextReaction, likes, dislikes, updating: true };
    });
    try {
      const optimistic = await updateArticleReaction(articleId, computeNextReaction(state.reaction, wanted));
      if (!mountedRef.current) return;
      setState(s => ({
        ...s,
        reaction: optimistic.reaction,
        likes: optimistic.counts?.likes || s.likes,
        dislikes: optimistic.counts?.dislikes || s.dislikes,
        updating: false,
      }));
    } catch (e: any) {
      if (!mountedRef.current) return;
      // Rollback by reloading
      await load();
      setState(s => ({ ...s, updating: false, error: e?.message || 'Failed to update reaction' }));
    }
  }, [articleId, state.reaction, load]);

  return {
    ...state,
    like: () => toggle('LIKE'),
    dislike: () => toggle('DISLIKE'),
    refresh: load,
  };
}
