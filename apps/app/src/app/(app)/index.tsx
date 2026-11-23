import { cs, ROLE_LABELS } from '@mtsales/shared';
import { useMe } from '@/lib/useMe';
import { Body, Card, Loading, Screen, Title } from '@/ui/components';

export default function MyDayScreen() {
  const { me, isLoading } = useMe();
  if (isLoading || !me) return <Loading />;
  return (
    <Screen>
      <Title>{cs.myDay.greeting(me.name.split(' ')[0] ?? me.name)}</Title>
      <Body muted>{me.roles.map((r) => ROLE_LABELS[r]).join(' · ')}</Body>
      <Card>
        <Body>{cs.myDay.placeholder}</Body>
      </Card>
    </Screen>
  );
}
