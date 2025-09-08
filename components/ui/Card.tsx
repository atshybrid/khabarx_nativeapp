import { Article } from '@/types';
import { Image, Text, View, TouchableOpacity } from 'react-native';
import { IconSymbol } from './IconSymbol';

export default function Card({ article }: { article: Article }) {
  return (
    <View
      style={{
        backgroundColor: '#fff',
        flex: 1,
      }}>
      <Image
        style={{ width: '100%', height: 300, backgroundColor: '#F5F5F5' }}
        source={{ uri: article.image }}
      />
      <View style={{ padding: 16, flex: 1 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold' }}>{article.title}</Text>
        <Text style={{ color: '#555', marginTop: 8, fontSize: 16, lineHeight: 24 }}>
          {article.summary}
        </Text>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16,
          borderTopWidth: 1,
          borderTopColor: '#E5E5E5',
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image
            style={{ width: 40, height: 40, borderRadius: 20, marginRight: 8 }}
            source={{ uri: article.author.avatar }}
          />
          <View>
            <Text style={{ fontWeight: 'bold' }}>{article.author.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: '#555' }}>76</Text>
              <IconSymbol name="eye" size={16} color="#555" style={{ marginLeft: 4, marginRight: 16 }} />
              <Text style={{ color: '#555' }}>{article.createdAt}</Text>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity style={{ alignItems: 'center', marginRight: 24 }}>
            <IconSymbol name="hand.thumbsup" size={24} color="#555" />
            <Text style={{ color: '#555', fontSize: 12 }}>Like</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ alignItems: 'center' }}>
            <IconSymbol name="arrowshape.turn.up.right" size={24} color="#555" />
            <Text style={{ color: '#555', fontSize: 12 }}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
