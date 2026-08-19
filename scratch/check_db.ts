import fetch from 'node-fetch'; // or global fetch if on Node 18+

const HASURA_QUERY_URL = 'https://rwbwrptitwkxuqgmbbpi.hasura.ap-south-1.nhost.run/v1/query';
const ADMIN_SECRET = ';;8Y)PN:F1=aF$;mruZuDhtRhd@IZ:QZ';

async function main() {
  const sql = `
SELECT
    u.id AS user_id,
    u.email,
    om.org_id,
    o.name AS organization,
    om.role
FROM auth.users u
JOIN public.org_members om
    ON om.user_id = u.id
JOIN public.organizations o
    ON o.id = om.org_id
WHERE u.email LIKE 'editor.a%'
ORDER BY u.email, o.name;
  `;

  const res = await fetch(HASURA_QUERY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': ADMIN_SECRET,
    },
    body: JSON.stringify({
      type: 'run_sql',
      args: { sql },
    }),
  });

  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
}

main().catch(console.error);
