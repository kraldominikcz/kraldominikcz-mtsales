import { useMutation } from '@tanstack/react-query';
import * as Device from 'expo-device';
import { useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { cs, PASSWORD_MIN_LENGTH, type LoginResult, type SessionTokens } from '@mtsales/shared';
import { IS_WEB } from '@/lib/config';
import { session } from '@/lib/session';
import { errorMessage, useTRPC } from '@/lib/trpc';
import { Banner, Body, Button, Card, Screen, TextField, Title } from '@/ui/components';
import { spacing } from '@/ui/theme';

/** Kroky přihlášení. Tokeny držíme jen v paměti (ne v URL). */
type Step =
  | { kind: 'credentials' }
  | { kind: 'changePassword'; token: string }
  | { kind: 'totpSetup'; token: string; uri?: string; secret?: string }
  | { kind: 'recoveryCodes'; codes: string[]; tokens: SessionTokens }
  | { kind: 'totp'; token: string; recovery: boolean };

const deviceName = IS_WEB ? 'Prohlížeč' : (Device.deviceName ?? Device.modelName ?? Platform.OS);

export default function LoginScreen() {
  const [step, setStep] = useState<Step>({ kind: 'credentials' });
  const [error, setError] = useState<string | null>(null);

  const next = (result: LoginResult) => {
    setError(null);
    if (result.status === 'password_change_required') setStep({ kind: 'changePassword', token: result.onboardingToken });
    else if (result.status === 'totp_setup_required') setStep({ kind: 'totpSetup', token: result.onboardingToken });
    else setStep({ kind: 'totp', token: result.challengeToken, recovery: false });
  };
  const restart = (message?: string) => {
    setStep({ kind: 'credentials' });
    setError(message ?? null);
  };

  return (
    <Screen centered>
      <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
        <Title>{cs.appName}</Title>
      </View>
      {error ? <Banner kind="error">{error}</Banner> : null}
      {step.kind === 'credentials' && <CredentialsStep onResult={next} onError={setError} />}
      {step.kind === 'changePassword' && (
        <ChangePasswordStep token={step.token} onResult={next} onError={setError} onExpired={restart} />
      )}
      {step.kind === 'totpSetup' && (
        <TotpSetupStep
          step={step}
          onUpdate={setStep}
          onDone={(codes, tokens) => setStep({ kind: 'recoveryCodes', codes, tokens })}
          onError={setError}
          onExpired={restart}
        />
      )}
      {step.kind === 'recoveryCodes' && <RecoveryCodesStep codes={step.codes} tokens={step.tokens} />}
      {step.kind === 'totp' && (
        <TotpStep
          token={step.token}
          recovery={step.recovery}
          onToggle={() => setStep({ ...step, recovery: !step.recovery })}
          onError={setError}
          onExpired={restart}
        />
      )}
    </Screen>
  );
}

function isExpired(e: unknown) {
  return errorMessage(e) === cs.auth.sessionExpired;
}

function CredentialsStep(props: { onResult: (r: LoginResult) => void; onError: (m: string) => void }) {
  const trpc = useTRPC();
  const login = useMutation(trpc.auth.login.mutationOptions());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const submit = () =>
    login.mutate(
      { email, password, deviceName },
      { onSuccess: props.onResult, onError: (e) => props.onError(errorMessage(e)) },
    );
  return (
    <Card>
      <Title>{cs.auth.title}</Title>
      <TextField
        label={cs.auth.email}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="username"
      />
      <TextField
        label={cs.auth.password}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={submit}
      />
      <Button title={cs.auth.login} onPress={submit} loading={login.isPending} disabled={!email || !password} />
    </Card>
  );
}

function ChangePasswordStep(props: {
  token: string;
  onResult: (r: LoginResult) => void;
  onError: (m: string) => void;
  onExpired: (m: string) => void;
}) {
  const trpc = useTRPC();
  const change = useMutation(trpc.auth.changeInitialPassword.mutationOptions());
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const tooShort = pw.length > 0 && pw.length < PASSWORD_MIN_LENGTH;
  const mismatch = pw2.length > 0 && pw !== pw2;
  const submit = () =>
    change.mutate(
      { onboardingToken: props.token, newPassword: pw },
      {
        onSuccess: props.onResult,
        onError: (e) => (isExpired(e) ? props.onExpired(errorMessage(e)) : props.onError(errorMessage(e))),
      },
    );
  return (
    <Card>
      <Title>{cs.auth.changePasswordTitle}</Title>
      <Body muted>{cs.auth.changePasswordHint}</Body>
      <TextField
        label={cs.auth.newPassword}
        value={pw}
        onChangeText={setPw}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        error={tooShort ? `Alespoň ${PASSWORD_MIN_LENGTH} znaků.` : null}
      />
      <TextField
        label={cs.auth.newPasswordRepeat}
        value={pw2}
        onChangeText={setPw2}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        error={mismatch ? cs.auth.passwordsDontMatch : null}
      />
      <Button
        title={cs.common.continue}
        onPress={submit}
        loading={change.isPending}
        disabled={pw.length < PASSWORD_MIN_LENGTH || pw !== pw2}
      />
    </Card>
  );
}

function TotpSetupStep(props: {
  step: Extract<Step, { kind: 'totpSetup' }>;
  onUpdate: (s: Step) => void;
  onDone: (codes: string[], tokens: SessionTokens) => void;
  onError: (m: string) => void;
  onExpired: (m: string) => void;
}) {
  const trpc = useTRPC();
  const start = useMutation(trpc.auth.totpSetupStart.mutationOptions());
  const confirm = useMutation(trpc.auth.totpSetupConfirm.mutationOptions());
  const [code, setCode] = useState('');
  const { step } = props;
  const fail = (e: unknown) => (isExpired(e) ? props.onExpired(errorMessage(e)) : props.onError(errorMessage(e)));

  if (!step.uri) {
    return (
      <Card>
        <Title>{cs.auth.totpSetupTitle}</Title>
        <Body muted>
          Budete potřebovat aplikaci Microsoft Authenticator v telefonu. Nejpohodlnější je první přihlášení udělat na
          počítači a QR kód naskenovat telefonem.
        </Body>
        <Button
          title={cs.common.continue}
          loading={start.isPending}
          onPress={() =>
            start.mutate(
              { onboardingToken: step.token },
              { onSuccess: (r) => props.onUpdate({ ...step, uri: r.otpauthUri, secret: r.secret }), onError: fail },
            )
          }
        />
      </Card>
    );
  }

  return (
    <Card>
      <Title>{cs.auth.totpSetupTitle}</Title>
      <Body muted>{cs.auth.totpSetupHint}</Body>
      <View style={{ alignItems: 'center', padding: spacing.md, backgroundColor: '#fff' }}>
        <QRCode value={step.uri} size={200} />
      </View>
      {!IS_WEB && (
        <Button
          title="Otevřít v aplikaci Authenticator"
          variant="secondary"
          onPress={() => void Linking.openURL(step.uri!).catch(() => {})}
        />
      )}
      <Body muted>{cs.auth.totpSecretManual}</Body>
      <Body mono>{step.secret}</Body>
      <TextField
        label={cs.auth.totpCode}
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
      />
      <Button
        title={cs.common.continue}
        loading={confirm.isPending}
        disabled={code.length !== 6}
        onPress={() =>
          confirm.mutate(
            { onboardingToken: step.token, code, deviceName },
            { onSuccess: (r) => props.onDone(r.recoveryCodes, r.session), onError: fail },
          )
        }
      />
    </Card>
  );
}

function RecoveryCodesStep({ codes, tokens }: { codes: string[]; tokens: SessionTokens }) {
  return (
    <Card>
      <Title>{cs.auth.recoveryCodesTitle}</Title>
      <Banner kind="info">{cs.auth.recoveryCodesHint}</Banner>
      <View style={{ gap: spacing.xs }}>
        {codes.map((c) => (
          <Body key={c} mono>
            {c}
          </Body>
        ))}
      </View>
      <Button title={cs.auth.recoveryCodesDone} onPress={() => void session.signIn(tokens)} />
    </Card>
  );
}

function TotpStep(props: {
  token: string;
  recovery: boolean;
  onToggle: () => void;
  onError: (m: string) => void;
  onExpired: (m: string) => void;
}) {
  const trpc = useTRPC();
  const verify = useMutation(trpc.auth.totpVerify.mutationOptions());
  const [value, setValue] = useState('');
  const valid = props.recovery ? value.replace('-', '').length === 10 : value.length === 6;
  const submit = () =>
    verify.mutate(
      {
        challengeToken: props.token,
        deviceName,
        ...(props.recovery ? { recoveryCode: value } : { code: value }),
      },
      {
        onSuccess: (tokens) => void session.signIn(tokens),
        onError: (e) => {
          setValue('');
          if (isExpired(e)) props.onExpired(errorMessage(e));
          else props.onError(errorMessage(e));
        },
      },
    );
  return (
    <Card>
      <Title>{cs.auth.totpTitle}</Title>
      <Body muted>{props.recovery ? 'Zadejte jeden ze záložních kódů.' : cs.auth.totpHint}</Body>
      <TextField
        label={props.recovery ? cs.auth.recoveryCode : cs.auth.totpCode}
        value={value}
        onChangeText={(t) => setValue(props.recovery ? t.trim() : t.replace(/\D/g, '').slice(0, 6))}
        keyboardType={props.recovery ? 'default' : 'number-pad'}
        autoCapitalize="none"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        onSubmitEditing={() => valid && submit()}
        autoFocus
      />
      <Button title={cs.auth.login} onPress={submit} loading={verify.isPending} disabled={!valid} />
      <Button
        title={props.recovery ? cs.auth.useTotpCode : cs.auth.useRecoveryCode}
        variant="ghost"
        onPress={() => {
          setValue('');
          props.onToggle();
        }}
      />
    </Card>
  );
}
