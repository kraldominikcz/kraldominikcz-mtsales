import { useState } from 'react';
import { cs } from '@mtsales/shared';
import { session } from '@/lib/session';
import { Body, Button, Screen, Title } from '@/ui/components';

export default function UnlockScreen() {
  const [busy, setBusy] = useState(false);
  const unlock = async () => {
    setBusy(true);
    try {
      await session.unlock();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen centered>
      <Title>{cs.appName}</Title>
      <Body muted>Aplikace je zamčená.</Body>
      <Button title={cs.auth.biometricPrompt} onPress={unlock} loading={busy} />
      <Button title={cs.auth.logout} variant="ghost" onPress={() => void session.signOut()} />
    </Screen>
  );
}
