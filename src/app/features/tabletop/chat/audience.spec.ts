import type { SessionUser } from '../../../core/auth/auth.models';
import type { TableMember } from '../realtime/table.protocol';
import { audienceOptions, toAudience } from './audience';

const members: TableMember[] = [
  { id: 'mestre', displayName: 'Mestre', role: 'master' },
  { id: 'ana', displayName: 'Ana', role: 'player' },
  { id: 'bruno', displayName: 'Bruno', role: 'player' },
];

const user = (id: string, role: SessionUser['role']): SessionUser => ({
  id,
  username: id,
  displayName: id,
  role,
});

describe('audienceOptions', () => {
  it('offers the table, the master and a whisper to everyone else', () => {
    expect(audienceOptions(user('ana', 'player'), members).map((o) => o.label)).toEqual([
      'Toda a mesa',
      'Só o mestre',
      'Sussurro para Mestre',
      'Sussurro para Bruno',
    ]);
  });

  it('calls the master-only option a hidden roll for the master', () => {
    expect(audienceOptions(user('mestre', 'master'), members)[1].label).toBe('Só eu (oculta)');
  });
});

describe('toAudience', () => {
  it('turns an option back into the wire format', () => {
    expect(toAudience('public')).toEqual({ visibility: 'public', recipientId: null });
    expect(toAudience('gm')).toEqual({ visibility: 'gm', recipientId: null });
    expect(toAudience('whisper:bruno')).toEqual({ visibility: 'whisper', recipientId: 'bruno' });
  });
});
