// Builds panel/files.json (version + sha256 of every panel file) before pushing an update.
// Usage: node tools/release.js [version]   (no version = bump the last number)
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const panel = path.join(__dirname, '..', 'panel'), out = path.join(panel, 'files.json');
let prev = '1.0.0';
try { prev = JSON.parse(fs.readFileSync(out, 'utf8')).version; } catch (e) { prev = '1.0.-1'; }
const p = prev.split('.').map(Number); p[2] = (p[2] || 0) + 1;
const version = process.argv[2] || p.join('.');
const files = {};
(function walk(dir) {
  for (const n of fs.readdirSync(dir).sort()) {
    if (n.startsWith('.') || n === 'files.json' || n.endsWith('.new')) continue;
    const full = path.join(dir, n);
    if (fs.statSync(full).isDirectory()) walk(full);
    else files[path.relative(panel, full).split(path.sep).join('/')] = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
  }
})(panel);
fs.writeFileSync(out, JSON.stringify({ version, files }, null, 1));
console.log('files.json', version, Object.keys(files).length, 'files');
