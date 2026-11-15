require('dotenv').config({ path: 'backend/.env' });
const jwt = require('jsonwebtoken');

async function testWithAuth() {
  const baseURL = 'http://localhost:4000/api/v1';

  // Sign admin token
  const token = jwt.sign(
    {
      sub: 'cmw07gefq0000pousyxdsoal6',
      email: 'admin@dslstationery.lk',
      role: 'ADMIN',
      roleId: 'cmw4wm0hs0012u4us2g1pateo',
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const authHeaders = {
    Authorization: `Bearer ${token}`,
  };

  console.log('--- 1. Testing Product Analytics with Admin Auth ---');
  const analyticsRes = await fetch(`${baseURL}/products/admin/analytics`, { headers: authHeaders });
  console.log('Analytics status:', analyticsRes.status);
  const analytics = await analyticsRes.json();
  console.log('Analytics data:', analytics.data);

  console.log('\n--- 2. Testing CSV Export with Admin Auth ---');
  const csvRes = await fetch(`${baseURL}/products/export?format=csv`, { headers: authHeaders });
  console.log('CSV Export status:', csvRes.status, 'Content-Type:', csvRes.headers.get('content-type'));
  const csvText = await csvRes.text();
  const csvRows = csvText.split('\n').filter(Boolean);
  console.log('CSV Header row:', csvRows[0]);
  console.log('Total exported rows count (header + records):', csvRows.length);
  console.log('Sample data row:', csvRows[1]);

  console.log('\n--- 3. Testing XLSX Export with Admin Auth ---');
  const xlsxRes = await fetch(`${baseURL}/products/export?format=xlsx`, { headers: authHeaders });
  console.log('XLSX Export status:', xlsxRes.status, 'Content-Type:', xlsxRes.headers.get('content-type'));
  const xlsxBuffer = await xlsxRes.arrayBuffer();
  console.log('XLSX byte length:', xlsxBuffer.byteLength);

  console.log('\n--- 4. Testing Filtered Export (inStockOnly) ---');
  const filteredExportRes = await fetch(`${baseURL}/products/export?format=csv&inStockOnly=true`, { headers: authHeaders });
  const filteredCsv = await filteredExportRes.text();
  const filteredRows = filteredCsv.split('\n').filter(Boolean);
  console.log('Filtered CSV rows count:', filteredRows.length);

  console.log('\n--- 5. Testing Selected ID Export ---');
  const selectedExportRes = await fetch(`${baseURL}/products/export?format=csv&selectedIds=cmw0j4cro00089kusmwsbv48t`, { headers: authHeaders });
  const selectedCsv = await selectedExportRes.text();
  const selectedRows = selectedCsv.split('\n').filter(Boolean);
  console.log('Selected CSV row count (header + 1 record):', selectedRows.length);
  console.log('Selected record line:', selectedRows[1]);
}

testWithAuth().catch(console.error);
