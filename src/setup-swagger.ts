import { INestApplication, Logger } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { parse } from 'yaml';

const OPENAPI_REL = path.join('postman', 'openapi.yaml');

/**
 * Serves Swagger UI from `postman/openapi.yaml` (single source of truth with Postman import).
 */
export function setupSwagger(app: INestApplication): boolean {
  const yamlPath = path.join(process.cwd(), OPENAPI_REL);
  if (!fs.existsSync(yamlPath)) {
    Logger.warn(
      `Swagger UI not mounted: missing ${yamlPath} (run from project root).`,
      'Bootstrap',
    );
    return false;
  }
  const document = parse(
    fs.readFileSync(yamlPath, 'utf8'),
  ) as OpenAPIObject;
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'Task Board API',
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
  return true;
}
