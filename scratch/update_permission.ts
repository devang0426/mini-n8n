const HASURA_METADATA_URL = 'https://rwbwrptitwkxuqgmbbpi.hasura.ap-south-1.nhost.run/v1/metadata';
const ADMIN_SECRET = ';;8Y)PN:F1=aF$;mruZuDhtRhd@IZ:QZ';

async function main() {
  console.log('Updating org_members select permission...');

  // 1. Drop existing select permission for user role on org_members
  await fetch(HASURA_METADATA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': ADMIN_SECRET,
    },
    body: JSON.stringify({
      type: 'pg_drop_select_permission',
      args: {
        table: { name: 'org_members', schema: 'public' },
        role: 'user',
        source: 'default',
      },
    }),
  });

  // 2. Create updated select permission where user_id = X-Hasura-User-Id
  const res = await fetch(HASURA_METADATA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': ADMIN_SECRET,
    },
    body: JSON.stringify({
      type: 'pg_create_select_permission',
      args: {
        table: { name: 'org_members', schema: 'public' },
        role: 'user',
        source: 'default',
        permission: {
          columns: ['id', 'user_id', 'org_id', 'role', 'created_at', 'updated_at'],
          filter: {
            user_id: { _eq: 'X-Hasura-User-Id' },
          },
        },
      },
    }),
  });

  const json = await res.json();
  console.log('Result:', JSON.stringify(json, null, 2));
}

main().catch(console.error);
