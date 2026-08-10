const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
envFile.split('\n').forEach(line => {
  const t = line.trim();
  if (!t || t.startsWith('#')) return;
  const idx = t.indexOf('=');
  if (idx > 0) {
    const k = t.substring(0, idx).trim();
    let v = t.substring(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[k] = v;
  }
});

const { buildLeaveIcsForDepartments } = require('./src/lib/icalFeed');

async function run() {
  console.log('Testing buildLeaveIcsForDepartments...');
  try {
    const ics = await buildLeaveIcsForDepartments({
      departments: ['사업개발팀', '경영지원팀'],
      calendarName: '테스트 캘린더'
    });
    console.log('ICS generated successfully! Total length:', ics.length);
    console.log('Preview:\n', ics.slice(0, 500));
  } catch (e) {
    console.error('Error generating ICS:', e);
  }
}

run();
