import { PasKeySecurity } from './PasKeySecurity';

export async function testPasKeySecurity() {
  return PasKeySecurity.isKeystoreAvailable();
}
