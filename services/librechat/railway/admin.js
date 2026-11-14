// Creates or updates the LibreChat administrator from LIBRECHAT_ADMIN_EMAIL and
// LIBRECHAT_ADMIN_PASSWORD (Railway template bootstrap, runs before every start).
// Exit codes: 0 done, 1 MongoDB not reachable yet (caller retries), 3 other error.
'use strict';

const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
// Same credential bootstrap as the server, so the fingerprints recorded below match it.
require('../api/config/credentials');
const {
  getCredentialFingerprints,
  credentialMetadataCollection,
  credentialMetadataId,
} = require('@librechat/api');
const { User } = require('@librechat/data-schemas').createModels(mongoose);
require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });
const { connectDb } = require('~/db/connect');
const { registerUser } = require('~/server/services/AuthService');

const DEFAULT_EMAIL = 'admin@example.com';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = Math.max(8, parseInt(process.env.MIN_PASSWORD_LENGTH, 10) || 8);
const MAX_PASSWORD = 128;
const CONNECT_TIMEOUT_MS = 20000;

const log = (message) => console.log(`[railway-admin] ${message}`);

function adminEmail() {
  const raw = (process.env.LIBRECHAT_ADMIN_EMAIL || '').trim().toLowerCase();
  if (EMAIL_PATTERN.test(raw)) {
    return raw;
  }
  log(`WARNING: LIBRECHAT_ADMIN_EMAIL "${raw}" is not a valid email address; using ${DEFAULT_EMAIL}.`);
  return DEFAULT_EMAIL;
}

function adminPassword() {
  const raw = process.env.LIBRECHAT_ADMIN_PASSWORD || '';
  if (raw.length >= MIN_PASSWORD && raw.length <= MAX_PASSWORD && raw.trim().length > 0) {
    return raw;
  }
  log(
    `WARNING: LIBRECHAT_ADMIN_PASSWORD must be ${MIN_PASSWORD}-${MAX_PASSWORD} characters; ` +
      'it was not applied. Set a valid value on the LibreChat service and redeploy.',
  );
  return null;
}

async function connect() {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timed out')), CONNECT_TIMEOUT_MS),
  );
  await Promise.race([connectDb(), timeout]);
}

async function updateExisting(existing, password) {
  const update = {};
  if (existing.role !== 'ADMIN') {
    update.role = 'ADMIN';
  }
  const matches = Boolean(password && existing.password && bcrypt.compareSync(password, existing.password));
  if (password && !matches) {
    update.password = bcrypt.hashSync(password, 10);
    update.passwordVersion = Date.now();
  }
  if (Object.keys(update).length > 0) {
    await User.updateOne({ _id: existing._id }, { $set: update });
  }
  if (update.password) {
    log(`Password of ${existing.email} set from LIBRECHAT_ADMIN_PASSWORD.`);
  }
  log(`Administrator ${existing.email} is ready.`);
}

async function recordCredentialFingerprints() {
  // LibreChat records credential fingerprints only while the database has no users. The admin is
  // created before the server's first start, so record them here the same way the server would.
  if (await User.exists({})) {
    return;
  }
  await mongoose.connection.db.collection(credentialMetadataCollection).updateOne(
    { _id: credentialMetadataId },
    {
      $setOnInsert: {
        _id: credentialMetadataId,
        fingerprints: getCredentialFingerprints(),
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );
}

async function createAdmin(email, password) {
  await recordCredentialFingerprints();
  const secret = password || crypto.randomBytes(24).toString('base64url');
  let username = 'admin';
  if (await User.exists({ username })) {
    username = `admin-${crypto.randomBytes(3).toString('hex')}`;
  }
  const result = await registerUser(
    { email, name: 'Administrator', username, password: secret, confirm_password: secret },
    { emailVerified: true },
  );
  if (result.status !== 200) {
    throw new Error(`registerUser: ${result.message}`);
  }
  await User.updateOne({ email }, { $set: { role: 'ADMIN', emailVerified: true } });
  if (password) {
    log(`Administrator ${email} created with the password in LIBRECHAT_ADMIN_PASSWORD.`);
  } else {
    log(
      `Administrator ${email} created with a random password nobody knows (login locked). ` +
        'Set LIBRECHAT_ADMIN_PASSWORD to 8-128 characters and redeploy to unlock it.',
    );
  }
}

async function main() {
  try {
    await connect();
  } catch (err) {
    log(`MongoDB is not reachable yet (${err.message}).`);
    process.exit(1);
  }
  const email = adminEmail();
  const password = adminPassword();
  const existing = await User.findOne({ email }).select('+password');
  if (existing) {
    await updateExisting(existing, password);
  } else {
    await createAdmin(email, password);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    log(`Admin bootstrap failed: ${err.message}`);
    process.exit(3);
  });
