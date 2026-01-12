const execa = require("execa");
const fs = require('node:fs');
const path = require('node:path');

(async () => {
	await execa("pnpm", ["clean"], {
		cwd: __dirname + "/../",
		stdout: process.stdout,
		stderr: process.stderr,
	});

	execa("pnpm", ["dlx", "gulp", "watch"], {
		cwd: __dirname + "/../",
		stdout: process.stdout,
		stderr: process.stderr,
	});

	execa("pnpm", ["--filter", "backend", "watch"], {
		cwd: __dirname + "/../",
		stdout: process.stdout,
		stderr: process.stderr,
	});

	execa("pnpm", ["--filter", "client", "watch"], {
		cwd: __dirname + "/../",
		stdout: process.stdout,
		stderr: process.stderr,
	});

	execa("pnpm", ["--filter", "sw", "watch"], {
		cwd: __dirname + "/../",
		stdout: process.stdout,
		stderr: process.stderr,
	});

	const manifestPath = path.join(__dirname, '..', 'built', '_client_dist_', 'manifest.json');
	const maxManifestRetries = 90; // Approx 1 minute (20 * 3s)
	let manifestRetryCount = 0;

	const backendMaxRetries = 3;
	let backendRetryCount = 0;

	const startBackend = async () => {
		try {
			console.log('Attempting to start backend...');
			await execa("pnpm", ["start"], { // This effectively runs `pnpm --filter backend start`
				cwd: __dirname + "/../",
				stdout: process.stdout,
				stderr: process.stderr,
			});
			console.log('Backend started successfully.');
		} catch (e) {
			backendRetryCount++;
			console.error(`Backend start failed (Attempt ${backendRetryCount}/${backendMaxRetries}):`, e.message);
			if (backendRetryCount < backendMaxRetries) {
				console.log('Retrying backend start in 3 seconds...');
				await new Promise((resolve) => setTimeout(resolve, 3000));
				await startBackend(); // Await the recursive call
			} else {
				console.error('Backend failed to start after multiple retries. Giving up on backend start.');
				// Consider exiting if the backend is critical: process.exit(1);
			}
		}
	};

	const checkManifestAndStartBackend = async () => {
		if (fs.existsSync(manifestPath)) {
			console.log('manifest.json found.');
			await startBackend();
		} else {
			manifestRetryCount++;
			if (manifestRetryCount <= maxManifestRetries) {
				console.log(`manifest.json not found. Waiting for client build... (Attempt ${manifestRetryCount}/${maxManifestRetries}). Retrying in 3s.`);
				await new Promise((resolve) => setTimeout(resolve, 3000));
				await checkManifestAndStartBackend(); // Await the recursive call
			} else {
				console.error(`manifest.json not found after ${maxManifestRetries} retries. Backend cannot be started.`);
				// Consider exiting if the manifest is critical: process.exit(1);
			}
		}
	};

	// Initial call to start the process
	checkManifestAndStartBackend();
})();
