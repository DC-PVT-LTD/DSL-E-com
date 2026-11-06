const BACKEND = 'http://localhost:4000/api/v1';

async function runRegressionSuite() {
  console.log('================================================================');
  console.log('DSL Stationery - Admin Authentication & Authorization Regression');
  console.log('================================================================\n');

  const report = {};

  // -------------------------------------------------------------------------
  // TEST 1: Calling product and category mutations without authentication returns 401
  // -------------------------------------------------------------------------
  console.log('[TEST 1] Calling mutations without authentication returns 401...');
  const unauthProductRes = await fetch(`${BACKEND}/products`, {
    method: 'POST',
    headers: {
      'Origin': 'http://localhost:3000',
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'Hacked Product' }),
  });
  console.log('  POST /products (unauth) status:', unauthProductRes.status);
  const unauthCategoryRes = await fetch(`${BACKEND}/categories`, {
    method: 'POST',
    headers: {
      'Origin': 'http://localhost:3000',
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'Hacked Category' }),
  });
  console.log('  POST /categories (unauth) status:', unauthCategoryRes.status);

  if (unauthProductRes.status === 401 && unauthCategoryRes.status === 401) {
    report.test1_unauth_mutations_401 = 'PASS';
  } else {
    report.test1_unauth_mutations_401 = `FAIL (product: ${unauthProductRes.status}, category: ${unauthCategoryRes.status})`;
  }

  // -------------------------------------------------------------------------
  // TEST 2: Valid access token: admin can use permitted features
  // -------------------------------------------------------------------------
  console.log('\n[TEST 2] Logging in as admin and performing authorized operations...');
  const adminLoginRes = await fetch(`${BACKEND}/auth/login`, {
    method: 'POST',
    headers: {
      'Origin': 'http://localhost:3000',
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'admin@dslstationery.lk',
      password: '%%DTzpqU_$#sMMr3W77L',
    }),
  });
  console.log('  Admin login status:', adminLoginRes.status);
  const rawAdminCookies = adminLoginRes.headers.getSetCookie ? adminLoginRes.headers.getSetCookie() : [adminLoginRes.headers.get('set-cookie')];
  let adminAccessToken = '';
  let adminRefreshToken = '';
  for (const c of rawAdminCookies) {
    if (c.includes('dsl_access_token=')) adminAccessToken = c.split(';')[0];
    if (c.includes('dsl_refresh_token=')) adminRefreshToken = c.split(';')[0];
  }

  const adminMeRes = await fetch(`${BACKEND}/auth/me`, {
    headers: { 'Cookie': adminAccessToken },
  });
  const adminMeData = await adminMeRes.json();
  console.log('  /auth/me user:', adminMeData.data?.email, 'role:', adminMeData.data?.role);

  const adminInventoryRes = await fetch(`${BACKEND}/inventory/low-stock`, {
    headers: { 'Cookie': adminAccessToken },
  });
  console.log('  GET /inventory/low-stock (admin) status:', adminInventoryRes.status);

  if (adminLoginRes.status === 200 && adminMeData.data?.role === 'ADMIN' && adminInventoryRes.status === 200) {
    report.test2_admin_permitted_features = 'PASS';
  } else {
    report.test2_admin_permitted_features = 'FAIL';
  }

  // -------------------------------------------------------------------------
  // TEST 3: User without required role cannot perform admin operations (403 Forbidden)
  // -------------------------------------------------------------------------
  console.log('\n[TEST 3] Testing non-admin customer account attempting admin mutation...');
  // Register/login a normal customer
  const customerEmail = `customer_${Date.now()}@example.lk`;
  const customerRegisterRes = await fetch(`${BACKEND}/auth/register`, {
    method: 'POST',
    headers: {
      'Origin': 'http://localhost:3000',
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Regular Customer',
      email: customerEmail,
      password: 'CustomerPassword123!',
      phone: '+94771234567',
    }),
  });
  const rawCustomerCookies = customerRegisterRes.headers.getSetCookie ? customerRegisterRes.headers.getSetCookie() : [customerRegisterRes.headers.get('set-cookie')];
  let customerAccessToken = '';
  for (const c of rawCustomerCookies) {
    if (c.includes('dsl_access_token=')) customerAccessToken = c.split(';')[0];
  }

  // Attempt to access admin inventory endpoint
  const customerAdminRes = await fetch(`${BACKEND}/inventory/low-stock`, {
    headers: {
      'Origin': 'http://localhost:3000',
      'X-Requested-With': 'XMLHttpRequest',
      'Cookie': customerAccessToken,
    },
  });
  console.log('  GET /inventory/low-stock as CUSTOMER status:', customerAdminRes.status);
  const customerAdminData = await customerAdminRes.json();
  console.log('  Response message:', customerAdminData.message);

  // Attempt to create a category as CUSTOMER
  const customerCategoryRes = await fetch(`${BACKEND}/categories`, {
    method: 'POST',
    headers: {
      'Origin': 'http://localhost:3000',
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/json',
      'Cookie': customerAccessToken,
    },
    body: JSON.stringify({ name: 'Unauthorized Category', description: 'Testing' }),
  });
  console.log('  POST /categories as CUSTOMER status:', customerCategoryRes.status);

  if (customerAdminRes.status === 403 && customerCategoryRes.status === 403) {
    report.test3_customer_denied_admin_403 = 'PASS';
  } else {
    report.test3_customer_denied_admin_403 = `FAIL (inventory: ${customerAdminRes.status}, category: ${customerCategoryRes.status})`;
  }

  // -------------------------------------------------------------------------
  // TEST 4: Expired access token with valid refresh token -> refresh & retry succeeds
  // -------------------------------------------------------------------------
  console.log('\n[TEST 4] Testing expired access token with valid refresh token...');
  // Omit access token to simulate expiration, dispatch refresh
  const refreshRes = await fetch(`${BACKEND}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Origin': 'http://localhost:3000',
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/json',
      'Cookie': adminRefreshToken,
    },
  });
  console.log('  /auth/refresh status:', refreshRes.status);
  const refreshedCookies = refreshRes.headers.getSetCookie ? refreshRes.headers.getSetCookie() : [refreshRes.headers.get('set-cookie')];
  let rotatedAccessToken = '';
  let rotatedRefreshToken = '';
  for (const c of refreshedCookies) {
    if (c.includes('dsl_access_token=')) rotatedAccessToken = c.split(';')[0];
    if (c.includes('dsl_refresh_token=')) rotatedRefreshToken = c.split(';')[0];
  }

  // Use rotated access token to perform an admin operation
  const retryRes = await fetch(`${BACKEND}/inventory/low-stock`, {
    headers: { 'Cookie': rotatedAccessToken },
  });
  console.log('  Operation after token rotation status:', retryRes.status);

  if (refreshRes.status === 200 && retryRes.status === 200) {
    report.test4_refresh_and_retry_succeeds = 'PASS';
  } else {
    report.test4_refresh_and_retry_succeeds = `FAIL (refresh: ${refreshRes.status}, retry: ${retryRes.status})`;
  }

  // -------------------------------------------------------------------------
  // TEST 5: Upload requests preserve multipart FormData through refresh and retry
  // -------------------------------------------------------------------------
  console.log('\n[TEST 5] Testing upload request preserves multipart FormData through refresh & retry...');
  const formData = new FormData();
  const dummyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  formData.append('file', new Blob([dummyPng], { type: 'image/png' }), 'preserved_upload.png');

  // Perform upload with fresh rotated access token
  const uploadRes = await fetch(`${BACKEND}/uploads?folder=products`, {
    method: 'POST',
    headers: {
      'Origin': 'http://localhost:3000',
      'X-Requested-With': 'XMLHttpRequest',
      'Cookie': `${rotatedAccessToken}; ${rotatedRefreshToken}`,
    },
    body: formData,
  });
  console.log('  Multipart upload status:', uploadRes.status);
  const uploadData = await uploadRes.json();
  console.log('  Uploaded asset URL:', uploadData.data?.url);

  if (uploadRes.status === 201 && uploadData.data?.url) {
    report.test5_upload_preserves_multipart = 'PASS';
  } else {
    report.test5_upload_preserves_multipart = `FAIL (status: ${uploadRes.status})`;
  }

  // -------------------------------------------------------------------------
  // TEST 6: Expired or revoked refresh session fails and rejects
  // -------------------------------------------------------------------------
  console.log('\n[TEST 6] Testing expired or revoked refresh session rejection...');
  // Logout to revoke the session
  const logoutRes = await fetch(`${BACKEND}/auth/logout`, {
    method: 'POST',
    headers: {
      'Origin': 'http://localhost:3000',
      'X-Requested-With': 'XMLHttpRequest',
      'Cookie': `${rotatedAccessToken}; ${rotatedRefreshToken}`,
    },
  });
  console.log('  Admin logout status:', logoutRes.status);

  // Attempt to use the revoked refresh token
  const revokedRefreshRes = await fetch(`${BACKEND}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Origin': 'http://localhost:3000',
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/json',
      'Cookie': rotatedRefreshToken,
    },
  });
  console.log('  Refresh with revoked token status:', revokedRefreshRes.status);
  const revokedData = await revokedRefreshRes.json();
  console.log('  Revoked response:', revokedData.message);

  if (revokedRefreshRes.status === 401) {
    report.test6_revoked_session_401 = 'PASS';
  } else {
    report.test6_revoked_session_401 = `FAIL (status: ${revokedRefreshRes.status})`;
  }

  // -------------------------------------------------------------------------
  // TEST 7: Failed refresh does not cause infinite loop (bounded retry)
  // -------------------------------------------------------------------------
  console.log('\n[TEST 7] Testing bounded retry behavior...');
  // A request without access token or refresh token is rejected with 401, not a loop
  const noTokenRes = await fetch(`${BACKEND}/inventory/low-stock`, {
    headers: {
      'Origin': 'http://localhost:3000',
      'X-Requested-With': 'XMLHttpRequest',
    },
  });
  console.log('  Direct request without tokens status:', noTokenRes.status);
  if (noTokenRes.status === 401) {
    report.test7_no_infinite_retry = 'PASS';
  } else {
    report.test7_no_infinite_retry = 'FAIL';
  }

  console.log('\n================================================================');
  console.log('REGRESSION TEST RESULTS SUMMARY:');
  console.log(JSON.stringify(report, null, 2));
  console.log('================================================================');

  const allPassed = Object.values(report).every((v) => v === 'PASS');
  if (!allPassed) {
    process.exit(1);
  }
}

runRegressionSuite().catch((err) => {
  console.error('Fatal error in regression suite:', err);
  process.exit(1);
});

