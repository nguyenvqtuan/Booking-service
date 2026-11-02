import { Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageChannel } from '@booking/shared';
import { FakeProvider } from './fake.provider.js';
import { SMS_PROVIDER, ZNS_PROVIDER } from './message-provider.js';
import { ZnsTokenStore } from './zns/zns-token.store.js';
import { ZnsProvider } from './zns/zns.provider.js';

const isLive = (config: ConfigService) => config.get<string>('MESSAGE_PROVIDER') === 'live';

const providers: Provider[] = [
  ZnsTokenStore,
  ZnsProvider,
  {
    provide: ZNS_PROVIDER,
    inject: [ConfigService, ZnsProvider],
    useFactory: (config: ConfigService, zns: ZnsProvider) =>
      isLive(config) ? zns : new FakeProvider(MessageChannel.Zns),
  },
  // Real SMS provider is added in BS-30.
  { provide: SMS_PROVIDER, useFactory: () => new FakeProvider(MessageChannel.Sms) },
];

/** MESSAGE_PROVIDER=live uses the real providers, otherwise the fakes (dev/tests). */
@Module({ providers, exports: [ZNS_PROVIDER, SMS_PROVIDER] })
export class MessagingModule {}
