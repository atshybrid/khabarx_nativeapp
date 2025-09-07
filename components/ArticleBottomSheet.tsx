import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Article } from '@/types';
import { Image } from 'expo-image';

interface ArticleBottomSheetProps {
  article: Article | null;
}

const ArticleBottomSheet = React.forwardRef<BottomSheetModal, ArticleBottomSheetProps>((props, ref) => {
  const { article } = props;
  const snapPoints = useMemo(() => ['95%'], []);

  if (!article) {
    return null;
  }

  return (
    <BottomSheetModal
      ref={ref}
      index={0}
      snapPoints={snapPoints}
      backdropComponent={(backdropProps) => (
        <BottomSheetBackdrop {...backdropProps} disappearsOnIndex={-1} appearsOnIndex={0} />
      )}
    >
      <View style={styles.container}>
        <Image source={{ uri: article.image }} style={styles.image} />
        <View style={styles.header}>
          <View style={styles.authorInfo}>
            <Image source={{ uri: article.author.avatar }} style={styles.avatar} />
            <View>
              <Text style={styles.authorName}>{article.author.name}</Text>
              <Text style={styles.authorDesignation}>Sr Reporter, మన రంగారెడ్డి</Text>
            </View>
          </View>
          <View style={styles.locationInfo}>
            <Text style={styles.link}>way2.co/encmt8</Text>
            <Text style={styles.location}>Ranga Reddy (D)</Text>
          </View>
        </View>
        <View style={styles.contentContainer}>
          <Text style={styles.title}>{article.title}</Text>
          <Text style={styles.body}>{article.body}</Text>
        </View>
        <View style={styles.footer}>
            <Text style={styles.pinned}>Top Story / Pinned</Text>
            <View style={styles.actions}>
                <View style={styles.action}>
                    <Text>👍</Text>
                    <Text style={styles.actionText}>19</Text>
                </View>
                <View style={styles.action}>
                    <Text>👎</Text>
                    <Text style={styles.actionText}>13</Text>
                </View>
                <View style={styles.action}>
                    <Text>💬</Text>
                    <Text style={styles.actionText}>1</Text>
                </View>
            </View>
        </View>
        <View style={styles.bottomBar}>
            <Text>💬</Text>
            <Text>⚠️</Text>
            <Text>...</Text>
            <Text>➤</Text>
        </View>
      </View>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    image: {
        width: '100%',
        height: 250,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        backgroundColor: 'rgba(0,0,0,0.5)',
        position: 'absolute',
        top: 180,
        left: 0,
        right: 0,
    },
    authorInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 10,
    },
    authorName: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    authorDesignation: {
        color: '#fff',
        fontSize: 12,
    },
    locationInfo: {
        alignItems: 'flex-end',
    },
    link: {
        color: '#fff',
        fontSize: 12,
    },
    location: {
        color: '#fff',
        fontSize: 12,
    },
    contentContainer: {
        padding: 15,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        marginTop: 10,
        marginBottom: 10,
    },
    body: {
        fontSize: 18,
        lineHeight: 28,
    },
    footer: {
        padding: 15,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    pinned: {
        color: '#888',
        fontSize: 12,
        marginBottom: 15,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    action: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionText: {
        marginLeft: 5,
        fontSize: 16,
    },
    bottomBar: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        padding: 15,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    }
});

export default ArticleBottomSheet;
