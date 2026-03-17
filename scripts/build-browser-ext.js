#!/usr/bin/env node
// scripts/build-browser-ext.js
// Packages browser-extension/ into a ZIP (loadable as unpacked extension)
// and generates a CRX3 file for distribution.

const AdmZip = require('adm-zip');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const extDir = path.resolve(__dirname, '..', 'browser-extension');
const outDir = path.resolve(__dirname, '..', 'dist');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// ── Step 1: Create ZIP ──
const zip = new AdmZip();
const files = ['manifest.json', 'background.js', 'content.js', 'popup.html', 'popup.js'];
for (const f of files) {
  const fp = path.join(extDir, f);
  if (fs.existsSync(fp)) zip.addLocalFile(fp);
}

const iconsDir = path.join(extDir, 'icons');
if (fs.existsSync(iconsDir)) {
  for (const f of fs.readdirSync(iconsDir)) {
    zip.addLocalFile(path.join(iconsDir, f), 'icons');
  }
}

const zipPath = path.join(outDir, 'codebreeze-bridge.zip');
zip.writeZip(zipPath);
console.log(`ZIP: ${zipPath} (${fs.statSync(zipPath).size} bytes)`);

// ── Step 2: Create CRX3 ──
// CRX3 format: magic + version + header_size + header + zip_data
// Generate a throwaway key for self-signed CRX (for sideloading)
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'der' },
  privateKeyEncoding: { type: 'pkcs8', format: 'der' },
});

const zipData = fs.readFileSync(zipPath);

// Sign the ZIP data
const sign = crypto.createSign('SHA256');
sign.update(zipData);
const signature = sign.sign({ key: crypto.createPrivateKey({ key: privateKey, format: 'der', type: 'pkcs8' }), padding: crypto.constants.RSA_PKCS1_PADDING });

// CRX3 uses a protobuf header, but for simple sideloading we use CRX2 format
// which is more widely supported for manual loading
// CRX2: "Cr24" + uint32 version(2) + uint32 pubkey_len + uint32 sig_len + pubkey + sig + zip
const crxPath = path.join(outDir, 'codebreeze-bridge.crx');
const magic = Buffer.from('Cr24');
const version = Buffer.alloc(4);
version.writeUInt32LE(2);
const pubKeyLen = Buffer.alloc(4);
pubKeyLen.writeUInt32LE(publicKey.length);
const sigLen = Buffer.alloc(4);
sigLen.writeUInt32LE(signature.length);

fs.writeFileSync(crxPath, Buffer.concat([
  magic, version, pubKeyLen, sigLen, publicKey, signature, zipData,
]));

console.log(`CRX: ${crxPath} (${fs.statSync(crxPath).size} bytes)`);
console.log('Done! Load the ZIP as an unpacked extension or install the CRX.');
