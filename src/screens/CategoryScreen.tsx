import React from 'react';
import { FlatList } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HomeStackParamList } from '../navigation/types';
import { KNOWLEDGE_BASE } from '../data/knowledgeBase';
import { Screen, QuestionRow, EmptyState } from '../components/UI';

type Props = NativeStackScreenProps<HomeStackParamList, 'Category'>;

export default function CategoryScreen({ route, navigation }: Props) {
  const { cat } = route.params;
  const items = KNOWLEDGE_BASE.filter((d) => d.cat === cat);

  React.useLayoutEffect(() => {
    navigation.setOptions({ title: cat });
  }, [navigation, cat]);

  return (
    <Screen>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListEmptyComponent={<EmptyState label="No entries in this topic yet." />}
        renderItem={({ item }) => (
          <QuestionRow
            question={item.q}
            catLabel={item.cat}
            onPress={() => navigation.navigate('Detail', { item })}
          />
        )}
      />
    </Screen>
  );
}
