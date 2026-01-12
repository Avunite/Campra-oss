import Router from '@koa/router';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Init router
const router = new Router();

const allPath = '/.well-known/(.*)';

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);
const clientAssets = `${_dirname}/../../../../client/assets/`;

router.use(allPath, async (ctx, next) => {
    ctx.set({
        'Access-Control-Allow-Headers': 'Accept',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'Vary',
    });
    await next();
});

router.options(allPath, async ctx => {
    ctx.status = 204;
});

router.get('/.well-known/apple-app-site-association', async ctx => {
    ctx.body = {
        "applinks": {
            "apps": [],
            "details": [
                {
                    "appID": "64ZCASRLNC.chat.campra.app",
                    "paths": ["*"],
                    "components": [
                        {
                            "/": "/verify-email/*",
                            "exclude": true
                        },
                        {
                            "/": "/miauth/*",
                            "exclude": true
                        },
                        {
                            "/": "/statusbar",
                            "exclude": true
                        },
                        {
                            "/": "/sounds",
                            "exclude": true
                        },
                        {
                            "/": "/plugin/*",
                            "exclude": true
                        },
                        {
                            "/": "/miauth/*",
                            "exclude": true
                        },
                        {
                            "/": "/api/*",
                            "exclude": true
                        }
                    ]
                }
            ]
        }
    };
});

router.get('/.well-known/assetlinks.json', async ctx => {
    ctx.set('Content-Type', 'application/json');
    ctx.body = [
        {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
                namespace: "android_app",
                package_name: "chat.campra.app",
                sha256_cert_fingerprints: [
                    "3E:C7:9C:F0:79:23:2D:6C:F7:7F:77:B1:3E:C6:69:4E:1B:47:2C:13:39:52:EC:C2:07:E5:EA:D0:70:41:C5:EB",
                    "A5:27:5C:D5:BF:CD:81:FF:BC:17:A6:E4:C3:2E:68:A6:21:48:5A:F7:DC:49:C8:3F:34:50:A2:DF:10:EB:3E:F6"
                ]
            }
        }
    ];
});

// Return 404 for other .well-known
router.all(allPath, async ctx => {
    ctx.status = 404;
});

export default router;