import { AuthProvider } from '../src/presentation/components/AuthProvider';
import { ConversationParkingWidget } from '../src/presentation/components/ConversationParkingWidget';

export default function Home() {
  return (
    <AuthProvider>
      <ConversationParkingWidget />
    </AuthProvider>
  );
}
