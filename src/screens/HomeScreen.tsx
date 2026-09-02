import React from 'react';
import { ScrollView, View, Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { HomeStackParamList } from '../navigation/types';
import { CATEGORIES } from '../data/knowledgeBase';
import { Screen, SectionTitle, HeroLine, CategoryRow, StatCard } from '../components/UI';
import { colors } from '../theme/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('Search')} hitSlop={10} style={{ padding: 4 }}>
          <MaterialCommunityIcons name="magnify" size={22} color="#fff" />
        </Pressable>
      ),
    });
  }, [navigation]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <HeroLine>
          A virtual consultant for UAE Corporate Tax, VAT, free zones vs. mainland, business
          formation, IFRS/IAS, AML and more — plus a live feed of new FTA and MoF guidance.
        </HeroLine>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          <StatCard n="9%" label="Standard corporate tax" />
          <StatCard n="0%" label="CT on QFZP qualifying income" />
          <StatCard n="5%" label="Standard VAT rate" />
          <StatCard n="15%" label="DMTT minimum ETR" />
        </View>
        <SectionTitle>Browse by topic</SectionTitle>
        {CATEGORIES.map((c) => (
          <CategoryRow
            key={c.name}
            name={c.name}
            count={c.count}
            icon={c.icon}
            onPress={() => navigation.navigate('Category', { cat: c.name })}
          />
        ))}
      </ScrollView>
    </Screen>
  );
}
