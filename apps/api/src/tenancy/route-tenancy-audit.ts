import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { type DiscoveryService, MetadataScanner, type Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../auth/public.decorator.js';
import { TENANT_AGNOSTIC_KEY, TENANT_SCOPED_KEY } from './tenancy.constants.js';

export interface RouteTenancy {
  controller: string;
  handler: string;
  kind: 'public' | 'tenant-scoped' | 'tenant-agnostic' | 'unscoped';
}

/**
 * Classifies every HTTP route handler. A protected route that neither injects
 * @CurrentSalon() nor is marked @TenantAgnostic() is "unscoped" — a likely data leak.
 */
export function auditRouteTenancy(
  discovery: DiscoveryService,
  reflector: Reflector,
): RouteTenancy[] {
  const scanner = new MetadataScanner();
  const routes: RouteTenancy[] = [];

  for (const wrapper of discovery.getControllers()) {
    const { instance, metatype } = wrapper;
    if (!instance || !metatype) continue;
    const prototype = Object.getPrototypeOf(instance) as Record<string, unknown>;

    for (const methodName of scanner.getAllMethodNames(prototype)) {
      const handler = prototype[methodName] as object;
      const isRoute =
        Reflect.getMetadata(PATH_METADATA, handler) !== undefined &&
        Reflect.getMetadata(METHOD_METADATA, handler) !== undefined;
      if (!isRoute) continue;

      const targets = [handler, metatype] as Parameters<Reflector['getAllAndOverride']>[1];
      const kind: RouteTenancy['kind'] = reflector.getAllAndOverride<boolean>(
        IS_PUBLIC_KEY,
        targets,
      )
        ? 'public'
        : Reflect.getMetadata(TENANT_SCOPED_KEY, prototype, methodName)
          ? 'tenant-scoped'
          : reflector.getAllAndOverride<string>(TENANT_AGNOSTIC_KEY, targets)
            ? 'tenant-agnostic'
            : 'unscoped';
      routes.push({ controller: metatype.name, handler: methodName, kind });
    }
  }
  return routes;
}
