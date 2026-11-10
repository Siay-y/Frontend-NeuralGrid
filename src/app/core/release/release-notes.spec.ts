import packageJson from '../../../../package.json';
import { APP_VERSION, RELEASES } from './release-notes';

const SEMVER = /^\d+\.\d+\.\d+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function compareVersions(a: string, b: string): number {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let index = 0; index < 3; index++) {
    if (left[index] !== right[index]) {
      return left[index] - right[index];
    }
  }
  return 0;
}

describe('release notes', () => {
  it('keeps the app version in sync with package.json', () => {
    expect(APP_VERSION).toBe(packageJson.version);
  });

  it('lists releases from newest to oldest without repeating a version', () => {
    for (let index = 1; index < RELEASES.length; index++) {
      expect(compareVersions(RELEASES[index - 1].version, RELEASES[index].version)).toBeGreaterThan(
        0,
      );
    }
  });

  it('describes every release with a valid version, date and at least one change', () => {
    for (const release of RELEASES) {
      expect(release.version).toMatch(SEMVER);
      expect(release.date).toMatch(ISO_DATE);
      expect(release.title.trim()).not.toBe('');
      expect(release.changes.length).toBeGreaterThan(0);
    }
  });

  it('never orders dates backwards', () => {
    for (let index = 1; index < RELEASES.length; index++) {
      expect(RELEASES[index - 1].date >= RELEASES[index].date).toBe(true);
    }
  });
});
