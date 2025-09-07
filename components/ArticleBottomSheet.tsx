import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Article } from '@/types';

interface ArticleBottomSheetProps {
  article: Article | null;
}

const ArticleBottomSheet = React.forwardRef<BottomSheetModal, ArticleBottomSheetProps>(({ article }, ref) => {
  const snapPoints = useMemo(() => ['25%', '50%', '90%'], []);

  if (!article) {
    return null;
  }

  return (
    <BottomSheetModal
      ref={ref}
      index={1}
      snapPoints={snapPoints}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
      )}
    >
      <View style={styles.contentContainer}>
        <Text style={styles.title}>{article.title}</Text>
        <Text style={styles.body}>{article.body}</Text>
      </View>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  body: {
    fontSize: 16,
  },
});

export default ArticleBottomSheet;