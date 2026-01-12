import Koa from 'koa';
import { User } from '@/models/entities/user.js';
import { UserIps } from '@/models/index.js';
import { fetchMeta } from '@/misc/fetch-meta.js';
import { IEndpoint } from './endpoints.js';
import authenticate, { AuthenticationError } from './authenticate.js';
import call from './call.js';
import { ApiError } from './error.js';
import Stripe from 'stripe';
import crypto from 'crypto';
import Logger from '@/services/logger.js';

const logger = new Logger('webhook-middleware');

const userIpHistories = new Map<User['id'], Set<string>>();
setInterval(() => {
    userIpHistories.clear();
}, 1000 * 60 * 60);

export default (endpoint: IEndpoint, ctx: Koa.Context) => new Promise<void>(async (res) => {
    const body = ctx.is('multipart/form-data')
        ? (ctx.request as any).body
        : ctx.method === 'GET'
            ? ctx.query
            : ctx.request.body;

    const reply = (x?: any, y?: ApiError) => {
        if (x == null) {
            ctx.status = 204;
        } else if (typeof x === 'number' && y) {
            ctx.status = x;
            ctx.body = {
                error: {
                    message: y!.message,
                    code: y!.code,
                    id: y!.id,
                    kind: y!.kind,
                    ...(y!.info ? { info: y!.info } : {}),
                },
            };
        } else {
            ctx.body = typeof x === 'string' ? JSON.stringify(x) : x;
        }
        res();
    };

    // Stripe webhook handling
    if (endpoint.name === 'stripe/webhook') {
        const sig = ctx.headers['stripe-signature'] as string;
        if (!sig) {
            reply(400, new ApiError({
                message: 'No Stripe signature provided',
                code: 'NO_SIGNATURE',
                id: '9f8e1fc0-9f9a-4f5a-8f5e-3f8f8f8f8f8f',
            }));
            return;
        }

        const instance = await fetchMeta();
        if (!instance.stripeKey || !instance.stripeWebhookSecret) {
            reply(500, new ApiError({
                message: 'Stripe is not configured properly',
                code: 'STRIPE_MISCONFIGURED',
                id: 'c02b9a7d-2a8b-4c24-b99c-f4e33ccb1292',
            }));
            return;
        }

        const stripe = new Stripe(instance.stripeKey, {
            apiVersion: '2024-06-20',
        });

        let event: Stripe.Event;

        try {
            event = stripe.webhooks.constructEvent(
                ctx.request.rawBody,
                sig,
                instance.stripeWebhookSecret
            );
        } catch (err) {
            reply(400, new ApiError({
                message: 'Invalid signature',
                code: 'INVALID_SIGNATURE',
                id: '5d504554-1a7e-4a7b-9fcf-88b17365f92f',
            }));
            return;
        }

        // If we get here, the signature is valid
        body.event = event;
    }

    // Mux webhook handling
    if (endpoint.name === 'mux/webhook') {
        const sig = ctx.headers['mux-signature'] as string;
        logger.info(`Received Mux webhook`);

        try {
            // Parse the raw webhook data
            const webhookData = JSON.parse(ctx.request.rawBody);
            logger.info(`Received Mux webhook type: ${webhookData.type}`);

            if (!webhookData.type || !webhookData.data) {
                throw new Error('Missing required webhook data');
            }

            const instance = await fetchMeta();
            if (!instance.mux_webhook_secret) {
                reply(500, new ApiError({
                    message: 'Mux is not configured properly',
                    code: 'MUX_MISCONFIGURED',
                    id: 'c02b9a7d-2a8b-4c24-b99c-f4e33ccb1293',
                }));
                return;
            }

            // Verify signature if provided
            if (sig) {
                const [timestampPart, signaturePart] = sig.split(',');
                const timestamp = timestampPart.split('=')[1];
                const signature = signaturePart.split('=')[1];

                const expectedSignature = crypto
                    .createHmac('sha256', instance.mux_webhook_secret)
                    .update(timestamp + '.' + ctx.request.rawBody)
                    .digest('hex');

                if (signature !== expectedSignature) {
                    logger.error('Invalid Mux signature');
                    reply(400, new ApiError({
                        message: 'Invalid signature',
                        code: 'INVALID_SIGNATURE',
                        id: '5d504554-1a7e-4a7b-9fcf-88b17365f92e',
                    }));
                    return;
                }
            }

            // Pass through the webhook data
            body.type = webhookData.type;
            body.data = webhookData.data;

            logger.info('Successfully processed Mux webhook');
        } catch (err) {
            logger.error(`Error processing Mux webhook: ${err.message}`);
            reply(400, new ApiError({
                message: 'Invalid webhook payload: ' + err.message,
                code: 'INVALID_PAYLOAD',
                id: '5d504554-1a7e-4a7b-9fcf-88b17365f92e',
            }));
            return;
        }
    }

    // Iffy webhook handling (following Stripe pattern)
    if (endpoint.name === 'iffy/webhook') {
        // Log all headers to see what Iffy is actually sending
        logger.info('Iffy webhook headers:', {
            allHeaders: ctx.headers,
            possibleSignatures: {
                'x-signature': ctx.headers['x-signature'],
                'x-hub-signature': ctx.headers['x-hub-signature'],
                'x-hub-signature-256': ctx.headers['x-hub-signature-256'],
                'signature': ctx.headers['signature'],
                'authorization': ctx.headers['authorization'],
            }
        });

        // Try different signature header names
        const sig = ctx.headers['x-signature'] as string ||
            ctx.headers['x-hub-signature-256'] as string ||
            ctx.headers['x-hub-signature'] as string ||
            ctx.headers['signature'] as string;

        if (!sig) {
            logger.error('No Iffy signature found in any expected header');
            reply(400, new ApiError({
                message: 'No Iffy signature provided',
                code: 'NO_SIGNATURE',
                id: 'f1g2h3i4-j5k6-l7m8-n9o0-p1q2r3s4t5u6',
            }));
            return;
        }

        const instance = await fetchMeta();
        if (!instance.iffyWebhookSecret) {
            reply(500, new ApiError({
                message: 'Iffy is not configured properly',
                code: 'IFFY_MISCONFIGURED',
                id: 'g2h3i4j5-k6l7-m8n9-o0p1-q2r3s4t5u6v7',
            }));
            return;
        }

        let webhookData: any;

        try {
            // Try different signature algorithms and formats
            const rawBody = ctx.request.rawBody;
            const secret = instance.iffyWebhookSecret;

            // Generate signatures with different algorithms
            const sha256Hex = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
            const sha256Base64 = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
            const sha1Hex = crypto.createHmac('sha1', secret).update(rawBody).digest('hex');

            logger.info('Signature comparison:', {
                receivedSignature: sig,
                rawBodyLength: rawBody?.length,
                secretLength: secret?.length,
                computedSignatures: {
                    sha256Hex,
                    sha256Base64,
                    sha1Hex,
                    sha256WithPrefix: `sha256=${sha256Hex}`,
                    sha1WithPrefix: `sha1=${sha1Hex}`,
                }
            });

            // Handle different signature formats that Iffy might use
            let receivedSignature = sig;
            let expectedSignature = sha256Hex; // Default to SHA256 hex

            if (sig.startsWith('sha256=')) {
                receivedSignature = sig.substring(7);
                expectedSignature = sha256Hex;
            } else if (sig.startsWith('sha1=')) {
                receivedSignature = sig.substring(5);
                expectedSignature = sha1Hex;
            } else if (sig === sha256Base64) {
                expectedSignature = sha256Base64;
            } else if (sig === sha1Hex) {
                expectedSignature = sha1Hex;
            }

            const isValid = expectedSignature === receivedSignature;

            logger.info('Signature validation result:', {
                isValid,
                receivedSignature,
                expectedSignature,
                originalSig: sig,
            });

            if (!isValid) {
                logger.error('Invalid Iffy signature - all attempts failed');
                reply(400, new ApiError({
                    message: 'Invalid signature',
                    code: 'INVALID_SIGNATURE',
                    id: 'h3i4j5k6-l7m8-n9o0-p1q2-r3s4t5u6v7w8',
                }));
                return;
            }

            // Parse webhook data after signature verification
            webhookData = JSON.parse(ctx.request.rawBody);

            if (!webhookData.event || !webhookData.payload) {
                throw new Error('Missing required webhook data');
            }

        } catch (err) {
            logger.error('Failed to verify Iffy webhook:', err);
            reply(400, new ApiError({
                message: 'Invalid webhook data or signature',
                code: 'INVALID_WEBHOOK',
                id: 'i4j5k6l7-m8n9-o0p1-q2r3-s4t5u6v7w8x9',
            }));
            return;
        }

        // If we get here, the signature is valid - pass through the webhook data
        body.id = webhookData.id;
        body.event = webhookData.event;
        body.payload = webhookData.payload;
        body.timestamp = webhookData.timestamp;
    }

    // Authentication
    authenticate(ctx.headers.authorization, ctx.method === 'GET' ? null : body['i']).then(([user, app]) => {
        // API invoking
        call(endpoint.name, user, app, body, ctx).then((res: any) => {
            if (ctx.method === 'GET' && endpoint.meta.cacheSec && !body['i'] && !user) {
                ctx.set('Cache-Control', `public, max-age=${endpoint.meta.cacheSec}`);
            }
            reply(res);
        }).catch((e: ApiError) => {
            reply(e.httpStatusCode ? e.httpStatusCode : e.kind === 'client' ? 400 : 500, e);
        });

        // Log IP
        if (user) {
            fetchMeta().then(meta => {
                if (!meta.enableIpLogging) return;
                const ip = ctx.ip;
                const ips = userIpHistories.get(user.id);
                if (ips == null || !ips.has(ip)) {
                    if (ips == null) {
                        userIpHistories.set(user.id, new Set([ip]));
                    } else {
                        ips.add(ip);
                    }
                    try {
                        UserIps.createQueryBuilder().insert().values({
                            createdAt: new Date(),
                            userId: user.id,
                            ip: ip,
                        }).orIgnore(true).execute();
                    } catch {
                        // Do nothing
                    }
                }
            });
        }
    }).catch(e => {
        if (e instanceof AuthenticationError) {
            ctx.response.status = 403;
            ctx.response.set('WWW-Authenticate', 'Bearer');
            ctx.response.body = {
                message: 'Authentication failed: ' + e.message,
                code: 'AUTHENTICATION_FAILED',
                id: 'b0a7f5f8-dc2f-4171-b91f-de88ad238e14',
                kind: 'client',
            };
            res();
        } else {
            reply(500, new ApiError());
        }
    });
});