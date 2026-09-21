import React, { useEffect, useState } from 'react';
import { PasKeySecurity } from './PasKeySecurity';

export default function SecurityBridgeTest() {
  const [result, setResult] = useState('Testing...');

  useEffect(() => {
    PasKeySecurity.isKeystoreAvailable()
      .then((data) => {
        setResult(JSON.stringify(data));
        console.log('PASKEY_BRIDGE_TEST', data);
      })
      .catch((error) => {
        setResult(`ERROR: ${error?.message || error}`);
        console.error('PASKEY_BRIDE_TEST', error);
      });
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h2>PasKey Security Test</h2>
      <pre>{result}</pre>
    </div>
  );
}
