import { AppLayout } from '@/components/layout/AppLayout';
import { Header } from '@/components/layout/Header';
import { ProfileClient } from './ProfileClient';

export default function Profile() {
  return (
    <AppLayout>
      <div>
        <Header title="Profile" />
        <ProfileClient />
      </div>
    </AppLayout>
  );
}