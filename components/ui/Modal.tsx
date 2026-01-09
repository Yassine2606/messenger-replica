import { Modal, View, Text, TouchableOpacity, Pressable, ScrollView } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';

interface ModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function CustomModal({ visible, title, onClose, children }: ModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      {/* Backdrop */}
      <Pressable
        onPress={onClose}
        className="flex-1 bg-black/50"
      />
      
      {/* Modal Content with Keyboard Avoiding */}
      <KeyboardAvoidingView behavior="padding" className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-white">
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-gray-200 px-6 py-4">
          <Text className="text-lg font-semibold text-gray-900">{title}</Text>
          <TouchableOpacity
            onPress={onClose}
            className="h-8 w-8 items-center justify-center rounded-full bg-gray-100"
            activeOpacity={0.7}>
            <Ionicons name="close" size={20} color="#374151" />
          </TouchableOpacity>
        </View>

        {/* Content with ScrollView to prevent overflow */}
        <ScrollView 
          className="px-6 py-6" 
          scrollEnabled={true}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
