import { useEffect, useState } from 'react';
import { Switch } from 'react-native';
import { cs, ROLE_LABELS } from '@mtsales/shared';
import { biometricsAvailable } from '@/lib/biometrics';
import { IS_WEB } from '@/lib/config';
import { secureStorage } from '@/lib/secureStorage';
import { session } from '@/lib/session';
import { useMe } from '@/lib/useMe';
import { Body, Button, Card, Loading, Row, Screen, Subtitle, Title } from '@/ui/components';

export default function AccountScreen() {
  const { me, isLoading } = useMe();
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioOn, setBioOn] = useState(false);

  useEffect(() => {
    if (IS_WEB) return;
    void biometricsAvailable().then(setBioAvailable);
    void secureStorage.getBiometricLock().then((v) => setBioOn(Boolean(v)));
  }, []);

  if (isLoading || !me) return <Loading />;
  return (
    <Screen>
      <Title>{cs.nav.account}</Title>
      <Card>
        <Subtitle>{me.name}</Subtitle>
        <Body muted>{me.email}</Body>
        <Body muted>{me.roles.map((r) => ROLE_LABELS[r]).join(' · ')}</Body>
      </Card>
      {!IS_WEB && bioAvailable && (
        <Card>
          <Row>
            <Body>{cs.auth.biometricEnable}</Body>
            <Switch
              value={bioOn}
              onValueChange={(v) => {
                setBioOn(v);
                void secureStorage.setBiometricLock(v);
              }}
            />
          </Row>
        </Card>
      )}
      <Button title={cs.auth.logout} variant="secondary" onPress={() => void session.signOut()} />
    </Screen>
  );
}
