import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { cs, ROLE_LABELS, ROLES, type Role, type UserDto } from '@mtsales/shared';
import { errorMessage, useTRPC } from '@/lib/trpc';
import { useMe } from '@/lib/useMe';
import { Banner, Body, Button, Card, Chip, Loading, Row, Screen, Subtitle, TextField, Title } from '@/ui/components';
import { spacing } from '@/ui/theme';

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('cs-CZ', { dateStyle: 'short', timeStyle: 'short' }) : cs.users.never;

export default function TeamScreen() {
  const trpc = useTRPC();
  const { can } = useMe();
  const users = useQuery(trpc.users.list.queryOptions());
  const [adding, setAdding] = useState(false);
  const [secret, setSecret] = useState<{ name: string; password: string } | null>(null);
  const canManage = can('users.manage');

  if (users.isLoading) return <Loading />;
  const list = users.data ?? [];

  return (
    <Screen>
      <Title>{cs.users.title}</Title>
      {users.error ? <Banner kind="error">{errorMessage(users.error)}</Banner> : null}
      {secret && <TempPasswordCard {...secret} onClose={() => setSecret(null)} />}
      {canManage && !adding && <Button title={cs.users.add} onPress={() => setAdding(true)} />}
      {canManage && adding && (
        <AddUserForm
          users={list}
          onCancel={() => setAdding(false)}
          onCreated={(name, password) => {
            setAdding(false);
            setSecret({ name, password });
          }}
        />
      )}
      {list.map((u) => (
        <UserCard key={u.id} user={u} users={list} canManage={canManage} onSecret={setSecret} />
      ))}
    </Screen>
  );
}

function TempPasswordCard(props: { name: string; password: string; onClose: () => void }) {
  return (
    <Card>
      <Subtitle>
        {cs.users.tempPasswordTitle}: {props.name}
      </Subtitle>
      <Body mono>{props.password}</Body>
      <Banner kind="info">{cs.users.tempPasswordHint}</Banner>
      <Button title="Hotovo" variant="secondary" onPress={props.onClose} />
    </Card>
  );
}

function RolePicker({ value, onChange }: { value: Role[]; onChange: (r: Role[]) => void }) {
  return (
    <Row wrap>
      {ROLES.map((r) => (
        <Chip
          key={r}
          label={ROLE_LABELS[r]}
          selected={value.includes(r)}
          onPress={() => onChange(value.includes(r) ? value.filter((x) => x !== r) : [...value, r])}
        />
      ))}
    </Row>
  );
}

function SupervisorPicker(props: {
  users: UserDto[];
  exceptId?: string;
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const candidates = props.users.filter((u) => u.isActive && u.id !== props.exceptId && u.roles.includes('manager'));
  return (
    <Row wrap>
      <Chip label={cs.users.noSupervisor} selected={props.value === null} onPress={() => props.onChange(null)} />
      {candidates.map((u) => (
        <Chip key={u.id} label={u.name} selected={props.value === u.id} onPress={() => props.onChange(u.id)} />
      ))}
    </Row>
  );
}

function AddUserForm(props: {
  users: UserDto[];
  onCancel: () => void;
  onCreated: (name: string, password: string) => void;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const create = useMutation(trpc.users.create.mutationOptions());
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<Role[]>(['sales']);
  const [supervisorId, setSupervisorId] = useState<string | null>(null);

  const submit = () =>
    create.mutate(
      { name, email, roles, supervisorId },
      {
        onSuccess: async (res) => {
          await qc.invalidateQueries({ queryKey: trpc.users.list.queryKey() });
          props.onCreated(res.user.name, res.temporaryPassword);
        },
      },
    );

  return (
    <Card>
      <Subtitle>{cs.users.add}</Subtitle>
      {create.error ? <Banner kind="error">{errorMessage(create.error)}</Banner> : null}
      <TextField label={cs.users.name} value={name} onChangeText={setName} />
      <TextField
        label={cs.auth.email}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Body muted>{cs.users.roles}</Body>
      <RolePicker value={roles} onChange={setRoles} />
      <Body muted>{cs.users.supervisor}</Body>
      <SupervisorPicker users={props.users} value={supervisorId} onChange={setSupervisorId} />
      <Row>
        <View style={{ flex: 1 }}>
          <Button title={cs.common.cancel} variant="secondary" onPress={props.onCancel} />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title={cs.common.save}
            onPress={submit}
            loading={create.isPending}
            disabled={name.trim().length < 2 || !email.includes('@') || roles.length === 0}
          />
        </View>
      </Row>
    </Card>
  );
}

function UserCard(props: {
  user: UserDto;
  users: UserDto[];
  canManage: boolean;
  onSecret: (s: { name: string; password: string }) => void;
}) {
  const { user } = props;
  const trpc = useTRPC();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: trpc.users.list.queryKey() });
  const update = useMutation(trpc.users.update.mutationOptions({ onSuccess: refresh }));
  const reset = useMutation(trpc.users.resetCredentials.mutationOptions({ onSuccess: refresh }));
  const [editing, setEditing] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [roles, setRoles] = useState<Role[]>(user.roles);
  const [supervisorId, setSupervisorId] = useState<string | null>(user.supervisorId);
  const supervisor = props.users.find((u) => u.id === user.supervisorId);
  const error = update.error ?? reset.error;

  return (
    <Card style={user.isActive ? undefined : { opacity: 0.6 }}>
      <Subtitle>{user.name}</Subtitle>
      <Body muted>{user.email}</Body>
      <Body>
        {user.roles.map((r) => ROLE_LABELS[r]).join(' · ')}
        {supervisor ? ` · ${cs.users.supervisor}: ${supervisor.name}` : ''}
      </Body>
      <Body muted>
        {user.isActive ? cs.users.active : cs.users.inactive} · {user.totpEnabled ? cs.users.totpOn : cs.users.totpOff} ·{' '}
        {cs.users.lastLogin}: {formatDate(user.lastLoginAt)}
      </Body>
      {error ? <Banner kind="error">{errorMessage(error)}</Banner> : null}

      {props.canManage && !editing && (
        <Row wrap>
          <Button title="Upravit" variant="secondary" onPress={() => setEditing(true)} />
          <Button
            title={user.isActive ? cs.users.deactivate : cs.users.activate}
            variant="ghost"
            loading={update.isPending}
            onPress={() => update.mutate({ id: user.id, isActive: !user.isActive })}
          />
          <Button
            title={confirmReset ? 'Opravdu obnovit?' : cs.users.resetCredentials}
            variant={confirmReset ? 'danger' : 'ghost'}
            loading={reset.isPending}
            onPress={() => {
              if (!confirmReset) return setConfirmReset(true);
              setConfirmReset(false);
              reset.mutate(
                { id: user.id },
                { onSuccess: (r) => props.onSecret({ name: user.name, password: r.temporaryPassword }) },
              );
            }}
          />
        </Row>
      )}
      {confirmReset && <Body muted>{cs.users.resetCredentialsHint}</Body>}

      {props.canManage && editing && (
        <View style={{ gap: spacing.sm }}>
          <Body muted>{cs.users.roles}</Body>
          <RolePicker value={roles} onChange={setRoles} />
          <Body muted>{cs.users.supervisor}</Body>
          <SupervisorPicker users={props.users} exceptId={user.id} value={supervisorId} onChange={setSupervisorId} />
          <Row>
            <View style={{ flex: 1 }}>
              <Button title={cs.common.cancel} variant="secondary" onPress={() => setEditing(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title={cs.common.save}
                loading={update.isPending}
                disabled={roles.length === 0}
                onPress={() =>
                  update.mutate({ id: user.id, roles, supervisorId }, { onSuccess: () => setEditing(false) })
                }
              />
            </View>
          </Row>
        </View>
      )}
    </Card>
  );
}
