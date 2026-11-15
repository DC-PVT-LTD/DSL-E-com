require('dotenv').config({ path: 'backend/.env' });
const fs = require('fs');
const jwt = require('jsonwebtoken');

async function testImportPreview() {
  const baseURL = 'http://localhost:4000/api/v1';

  const token = jwt.sign(
    { sub: 'cmw07gefq0000pousyxdsoal6', email: 'admin@dslstationery.lk', role: 'ADMIN', roleId: 'cmw4wm0hs0012u4us2g1pateo' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const fileBuffer = fs.readFileSync('scratch/test_import_safety.csv');
  const blob = new Blob([fileBuffer], { type: 'text/csv' });
  const formData = new FormData();
  formData.append('file', blob, 'test_import_safety.csv');

  console.log('--- Uploading test import file to /products/import/preview ---');
  const res = await fetch(`${baseURL}/products/import/preview`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  console.log('Preview HTTP status:', res.status);
  const data = await res.json();
  if (!res.ok) {
    console.error('Preview error response:', data);
    return;
  }

  console.log('\nPreview Summary:', data.data?.summary);
  console.log('\nPreview Rows Detail:');
  for (const r of data.data?.rows || []) {
    console.log(`Row #${r.rowNumber}: SKU=${r.sku || r.proposedSku || '(none)'} | Status=${r.status} | Errors=[${r.errors.join('; ')}] | Warnings=[${r.warnings.join('; ')}]`);
  }

  // Also test error report generation
  console.log('\n--- Testing Error Report Generation ---');
  const errRes = await fetch(`${baseURL}/products/import/error-report?format=csv`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rows: data.data.rows }),
  });
  console.log('Error report HTTP status:', errRes.status);
  const errCsv = await errRes.text();
  console.log('Error report header:', errCsv.split('\n')[0]);
  console.log('Error report sample row:', errCsv.split('\n')[1]);
}

testImportPreview().catch(console.error);

