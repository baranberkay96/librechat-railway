// Runs a Node script as the image's unprivileged `node` user (uid/gid 1000).
// Usage: node /app/railway/as-node.js /path/to/script.js [args...]
'use strict';

const NODE_UID = 1000;
const NODE_GID = 1000;

const [, , script, ...args] = process.argv;
if (!script) {
  console.error('[railway] as-node.js: missing script path');
  process.exit(2);
}

if (typeof process.getuid === 'function' && process.getuid() === 0) {
  try {
    process.initgroups('node', NODE_GID);
  } catch (err) {
    process.setgroups([NODE_GID]);
  }
  process.setgid(NODE_GID);
  process.setuid(NODE_UID);
  process.env.HOME = '/home/node';
  process.env.USER = 'node';
}

process.chdir('/app');
process.argv = [process.argv[0], script, ...args];
require(script);
