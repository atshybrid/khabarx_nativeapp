
import React, { forwardRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { FontAwesome } from '@expo/vector-icons';

const comments = [
  { id: '1', user: 'User1', text: 'Great article!' },
  { id: '2', user: 'User2', text: 'Very informative, thanks for sharing.' },
  { id: '3', user: 'User3', text: 'I have a question about the second paragraph.' },
];

const recommendedComments = [
  { id: '4', user: 'Expert1', text: 'Excellent point, I agree completely.' },
  { id: '5', user: 'Expert2', text: 'This is a well-researched and thoughtful piece.' },
];

const ArticleBottomSheet = forwardRef<BottomSheetModal>((_, ref) => {
  const renderBackdrop = (props) => (
    <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
  );

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={['50%', '85%']}
      backdropComponent={renderBackdrop}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Comments</Text>

        <Text style={styles.subtitle}>Recommended</Text>
        <FlatList
          data={recommendedComments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.commentContainer}>
              <FontAwesome name="user-circle" size={24} color="#ccc" />
              <View style={styles.commentTextContainer}>
                <Text style={styles.commentUser}>{item.user}</Text>
                <Text style={styles.commentText}>{item.text}</Text>
              </View>
            </View>
          )}
        />

        <Text style={styles.subtitle}>All Comments</Text>
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.commentContainer}>
              <FontAwesome name="user-circle" size={24} color="#ccc" />
              <View style={styles.commentTextContainer}>
                <Text style={styles.commentUser}>{item.user}</Text>
                <Text style={styles.commentText}>{item.text}</Text>
              </View>
            </View>
          )}
        />

        <View style={styles.postCommentContainer}>
          <TextInput placeholder="Add a comment..." style={styles.commentInput} />
          <FontAwesome name="paper-plane" size={24} color="#007AFF" />
        </View>
      </View>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  commentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  commentTextContainer: {
    marginLeft: 10,
  },
  commentUser: {
    fontWeight: 'bold',
    color: '#555',
  },
  commentText: {
    color: '#333',
  },
  postCommentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
    marginTop: 10,
  },
  commentInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingHorizontal: 15,
    marginRight: 10,
  },
});

export default ArticleBottomSheet;
