import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';

const HASURA_METADATA_URL = 'https://rwbwrptitwkxuqgmbbpi.hasura.ap-south-1.nhost.run/v1/metadata';
const ADMIN_SECRET = ';;8Y)PN:F1=aF$;mruZuDhtRhd@IZ:QZ';

async function main() {
  const metadataPath = path.join(process.cwd(), 'nhost', 'metadata', 'hasura_metadata.json');
  const metadataContent = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

  console.log('Applying updated Hasura metadata to remote Hasura engine...');

  const res = await fetch(HASURA_METADATA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': ADMIN_SECRET,
    },
    body: JSON.stringify({
      type: 'replace_metadata',
      args: metadataContent,
    }),
  });

  const json = await res.json();
  console.log('Result:', JSON.stringify(json, null, 2));
}

main().catch(console.error);
