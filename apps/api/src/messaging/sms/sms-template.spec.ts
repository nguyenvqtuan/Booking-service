import type { ReminderMessage } from '../message-provider.js';
import { DEFAULT_SMS_TEMPLATES, renderSms, stripDiacritics } from './sms-template.js';

const message = (locale: ReminderMessage['locale']): ReminderMessage => ({
  to: '+84901234567',
  locale,
  params: {
    customerName: 'Lê Chi',
    salonName: 'Tiệm Tóc Đẹp',
    serviceName: 'Gội đầu',
    time: '15:00',
    date: '2026-11-02',
  },
});

describe('SMS template', () => {
  it('strips Vietnamese diacritics (GSM-7 friendly)', () => {
    expect(stripDiacritics('Tiệm Tóc Đẹp đường Nguyễn Huệ')).toBe('Tiem Toc Dep duong Nguyen Hue');
  });

  it('renders the Vietnamese template without diacritics and with dd/mm/yyyy', () => {
    expect(renderSms(DEFAULT_SMS_TEMPLATES.vi, message('vi'))).toBe(
      'Tiem Toc Dep: Nhac lich hen Goi dau luc 15:00 ngay 02/11/2026. Hen gap quy khach!',
    );
  });

  it('renders the English template with mm/dd/yyyy', () => {
    expect(renderSms(DEFAULT_SMS_TEMPLATES.en, message('en'))).toContain('at 15:00 on 11/02/2026');
  });

  it('supports a custom template and leaves unknown placeholders untouched', () => {
    expect(renderSms('{name} - {time} - {unknown}', message('vi'))).toBe(
      'Le Chi - 15:00 - {unknown}',
    );
  });
});
