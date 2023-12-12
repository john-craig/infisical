import fasitfy from "fastify";
import { Knex } from "knex";
import { Logger } from "pino";
import type { FastifyCookieOptions } from "@fastify/cookie";
import cookie from "@fastify/cookie";
import type { FastifyCorsOptions } from "@fastify/cors";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import type { FastifyRateLimitOptions } from "@fastify/rate-limit";
import ratelimiter from "@fastify/rate-limit";

import { TSmtpService } from "@app/services/smtp/smtp-service";

import { getConfig } from "@lib/config/env";

import { globalRateLimiterCfg } from "./config/rateLimiter";
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from "./plugins/fastify-zod";
import { fastifyIp } from "./plugins/ip";
import { fastifySwagger } from "./plugins/swagger";
import { registerRoutes } from "./routes";

type TMain = {
  db: Knex;
  smtp: TSmtpService;
  logger?: Logger;
};

// Run the server!
export const main = async ({ db, smtp, logger }: TMain) => {
  const appCfg = getConfig();
  const server = fasitfy({
    logger,
    trustProxy: true
  }).withTypeProvider<ZodTypeProvider>();

  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);

  try {
    await server.register<FastifyCookieOptions>(cookie, {
      secret: appCfg.COOKIE_SECRET_SIGN_KEY
    });

    await server.register<FastifyCorsOptions>(cors, {
      credentials: true,
      origin: true
    });
    // pull ip based on various proxy headers
    await server.register(fastifyIp);

    await server.register(fastifySwagger);

    // Rate limiters and security headers
    await server.register<FastifyRateLimitOptions>(ratelimiter, globalRateLimiterCfg);
    await server.register(helmet, { contentSecurityPolicy: false });

    await server.register(registerRoutes, { prefix: "/api", smtp, db });
    await server.ready();
    server.swagger();
    return server;
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};
