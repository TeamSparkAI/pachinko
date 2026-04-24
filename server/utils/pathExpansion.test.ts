import * as os from 'os';
import { expandPath } from './pathExpansion';

const mockEnv = {
  HOME: '/Users/testuser',
  PATH: '/usr/bin:/bin',
  _UNDERSCORE_VAR: 'test_value',
  _A: 'underscore_a',
  KUBECONFIG_PATH: '/path/to/kubeconfig',
};

/** ~ and $HOME/ use os.homedir(), not the optional env map */
const home = os.homedir();

describe('expandPath', () => {
  it('does not expand shell command with $', () => {
    expect(
      expandPath("export $(grep -E 'KUBECONFIG_PATH=' .env | xargs)", mockEnv)
    ).toBe("export $(grep -E 'KUBECONFIG_PATH=' .env | xargs)");
  });

  it('expands $HOME prefix using os.homedir()', () => {
    expect(expandPath('$HOME/documents', mockEnv)).toBe(`${home}/documents`);
  });

  it('does not expand braced ${HOME} (handled separately from $HOME/ prefix only)', () => {
    expect(expandPath('${HOME}/documents', mockEnv)).toBe('${HOME}/documents');
  });

  it('expands underscore env var', () => {
    expect(expandPath('$_UNDERSCORE_VAR', mockEnv)).toBe('test_value');
  });

  it('does not expand lone $_', () => {
    expect(expandPath('$_', mockEnv)).toBe('$_');
  });

  it('expands $_A', () => {
    expect(expandPath('$_A', mockEnv)).toBe('underscore_a');
  });

  it('does not expand when name ends with trailing underscore', () => {
    expect(expandPath('$_A_', mockEnv)).toBe('$_A_');
  });

  it('expands ~ using os.homedir()', () => {
    expect(expandPath('~/documents', mockEnv)).toBe(`${home}/documents`);
  });

  it('does not expand positional $1', () => {
    expect(expandPath('echo $1', mockEnv)).toBe('echo $1');
  });

  it('does not expand lowercase $var', () => {
    expect(expandPath('echo $var', mockEnv)).toBe('echo $var');
  });

  it('does not expand valid format when var not in env', () => {
    expect(expandPath('echo $VAR_123', mockEnv)).toBe('echo $VAR_123');
  });
});
