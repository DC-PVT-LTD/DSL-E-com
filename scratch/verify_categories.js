require('dotenv').config({ path: 'backend/.env' });
const jwt = require('jsonwebtoken');

async function testCategories() {
  const baseURL = 'http://localhost:4000/api/v1';

  const token = jwt.sign(
    { sub: 'cmw07gefq0000pousyxdsoal6', email: 'admin@dslstationery.lk', role: 'ADMIN', roleId: 'cmw4wm0hs0012u4us2g1pateo' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const authHeaders = { Authorization: `Bearer ${token}` };

  console.log('--- 1. Testing Category Analytics ---');
  const analyticsRes = await fetch(`${baseURL}/categories/admin/analytics`, { headers: authHeaders });
  console.log('Analytics status:', analyticsRes.status);
  const analytics = await analyticsRes.json();
  console.log('Category analytics:', analytics.data);

  console.log('\n--- 2. Testing Category Listing with Products Count ---');
  const catListRes = await fetch(`${baseURL}/categories?includeCounts=true`);
  const catList = await catListRes.json();
  console.log('Total categories returned:', catList.data?.length);
  const sample = catList.data?.find(c => c.slug === 'pens');
  console.log('Sample category "Pens":', { id: sample?.id, name: sample?.name, productCount: sample?._count?.products });

  console.log('\n--- 3. Testing Category CSV Export ---');
  const csvRes = await fetch(`${baseURL}/categories/export?format=csv`, { headers: authHeaders });
  console.log('CSV status:', csvRes.status, 'Content-Type:', csvRes.headers.get('content-type'));
  const csvText = await csvRes.text();
  const csvRows = csvText.split('\n').filter(Boolean);
  console.log('CSV header:', csvRows[0]);
  console.log('Total exported categories count:', csvRows.length);
  console.log('Sample row:', csvRows[1]);

  console.log('\n--- 4. Testing Category XLSX Export ---');
  const xlsxRes = await fetch(`${baseURL}/categories/export?format=xlsx`, { headers: authHeaders });
  console.log('XLSX status:', xlsxRes.status);
  const xlsxBuffer = await xlsxRes.arrayBuffer();
  console.log('XLSX byte length:', xlsxBuffer.byteLength);
}

testCategories().catch(console.error);

