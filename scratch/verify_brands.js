require('dotenv').config({ path: 'backend/.env' });
const jwt = require('jsonwebtoken');

async function testBrands() {
  const baseURL = 'http://localhost:4000/api/v1';

  const token = jwt.sign(
    { sub: 'cmw07gefq0000pousyxdsoal6', email: 'admin@dslstationery.lk', role: 'ADMIN', roleId: 'cmw4wm0hs0012u4us2g1pateo' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const authHeaders = { Authorization: `Bearer ${token}` };

  console.log('--- 1. Testing Brand Analytics ---');
  const analyticsRes = await fetch(`${baseURL}/brands/admin/analytics`, { headers: authHeaders });
  console.log('Analytics status:', analyticsRes.status);
  const analytics = await analyticsRes.json();
  console.log('Brand analytics:', analytics.data);

  console.log('\n--- 2. Testing Brand Listing ---');
  const brandListRes = await fetch(`${baseURL}/brands`);
  const brandList = await brandListRes.json();
  console.log('Total brands returned:', brandList.data?.length);

  console.log('\n--- 3. Testing Brand CSV Export ---');
  const csvRes = await fetch(`${baseURL}/brands/export?format=csv`, { headers: authHeaders });
  console.log('CSV status:', csvRes.status, 'Content-Type:', csvRes.headers.get('content-type'));
  const csvText = await csvRes.text();
  const csvRows = csvText.split('\n').filter(Boolean);
  console.log('CSV header:', csvRows[0]);
  console.log('Total exported brands count:', csvRows.length);
  console.log('Sample row:', csvRows[1]);

  console.log('\n--- 4. Testing Brand XLSX Export ---');
  const xlsxRes = await fetch(`${baseURL}/brands/export?format=xlsx`, { headers: authHeaders });
  console.log('XLSX status:', xlsxRes.status);
  const xlsxBuffer = await xlsxRes.arrayBuffer();
  console.log('XLSX byte length:', xlsxBuffer.byteLength);
}

testBrands().catch(console.error);

