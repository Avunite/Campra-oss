import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

(async () => {
	fs.rmSync(__dirname + '/../packages/backend/built', { recursive: true, force: true });
	fs.rmSync(__dirname + '/../packages/client/built', { recursive: true, force: true });
	fs.rmSync(__dirname + '/../packages/sw/built', { recursive: true, force: true });
	fs.rmSync(__dirname + '/../built', { recursive: true, force: true });
})();
