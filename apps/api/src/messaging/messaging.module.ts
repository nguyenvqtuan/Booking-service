import { Module } from '@nestjs/common';
import { MessageChannel } from '@booking/shared';
import { FakeProvider } from './fake.provider.js';
import { SMS_PROVIDER, ZNS_PROVIDER } from './message-provider.js';

/** Real ZNS/SMS providers are added in BS-29/BS-30; until then both channels use the fake. */
@Module({
  providers: [
    { provide: ZNS_PROVIDER, useFactory: () => new FakeProvider(MessageChannel.Zns) },
    { provide: SMS_PROVIDER, useFactory: () => new FakeProvider(MessageChannel.Sms) },
  ],
  exports: [ZNS_PROVIDER, SMS_PROVIDER],
})
export class MessagingModule {}
